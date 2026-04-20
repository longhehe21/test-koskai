/**
 * MuseTalkClient — WebSocket client cho MuseTalk avatar server.
 *
 * Protocol:
 *  Connect  → send JSON config (avatar_id, avatar_path)
 *  sendAudio(wav) → server stream JPEG/WebP frames (binary) + "CHUNK_DONE" (string)
 *  sendAudio() returns a Promise that resolves when MIN_BUFFER_FRAMES frames
 *  have been received (or CHUNK_DONE arrives for short clips).
 *  Caller awaits this promise before starting audio playback → no lip-sync gap.
 *
 * Timing:
 *  onFrame callback receives frameIndex so canvas can schedule draws
 *  against wall-clock time instead of processing-speed.
 *
 * Resilience:
 *  - WebSocket ping/pong keepalive mỗi 15s để phát hiện silent drop sớm.
 *  - Auto-reconnect với exponential backoff (1s → 2s → 4s, tối đa 5 lần).
 */

// C3: Không fallback về IP hardcode — env var phải được set (cùng guard với ConversationController)
const WS_URL = import.meta.env.RENDERER_VITE_MUSETALK_URL as string;

const DEFAULT_AVATAR_ID   = 'idle_nhanvien';
const DEFAULT_AVATAR_PATH = 'data/video/idle_nhanvien.mp4';

const CONNECT_TIMEOUT_MS  = 5_000;
const KEEPALIVE_INTERVAL_MS = 15_000;
const RECONNECT_BASE_MS   = 1_000;
const RECONNECT_MAX_ATTEMPTS = 5;

/**
 * Số frames cần nhận trước khi resolve bufferReady (bắt đầu phát audio).
 *
 * Với BATCH_SIZE=4 trên server: frames 0-3 đến cùng lúc (~167ms).
 * MIN=4 → resolve khi frame 3 đến = cuối batch đầu tiên, không chờ batch 2.
 * Đảm bảo 4 frames đã decode song song trước khi audio bắt đầu → playback mượt.
 */
/** Số frames tối thiểu luôn phải buffer dù audio ngắn */
const MIN_BUFFER_FRAMES = 8;

export type FrameRenderedCallback = () => void;
/** onRendered phải được gọi sau khi canvas xử lý xong frame */
export type MuseTalkFrameCallback = (
  blob: Blob,
  onRendered: FrameRenderedCallback,
  frameIndex: number,
) => void;
export type MuseTalkDoneCallback = () => void;
export type MuseTalkErrorCallback = (err: Error) => void;

export class MuseTalkClient {
  private ws: WebSocket | null = null;
  private connected = false;
  private intentionalClose = false;

  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;

  // Callback khi kết nối thành công (kể cả reconnect) — dùng để cập nhật UI status
  private onConnected: (() => void) | null = null;

  // CHUNK_DONE timing
  private pendingFrames = 0;
  private chunkDoneReceived = false;

  // chunkId vô hiệu hoá stale callbacks từ chunk cũ
  private chunkId = 0;

  // Frame index trong chunk hiện tại (0-based)
  private framesReceived = 0;

  // Buffer-ready promise: resolve khi đủ targetFrames received (hoặc CHUNK_DONE)
  private bufferReadyResolve: (() => void) | null = null;
  private bufferReadyFired = false;
  private bufferTargetFrames = MIN_BUFFER_FRAMES;

  private readonly onFrame: MuseTalkFrameCallback;
  private readonly onDone: MuseTalkDoneCallback;
  private readonly onError: MuseTalkErrorCallback;

  private avatarId: string   = DEFAULT_AVATAR_ID;
  private avatarPath: string = DEFAULT_AVATAR_PATH;

  constructor(opts: {
    onFrame: MuseTalkFrameCallback;
    onDone: MuseTalkDoneCallback;
    onError: MuseTalkErrorCallback;
    onConnected?: () => void;
  }) {
    this.onFrame = opts.onFrame;
    this.onDone = opts.onDone;
    this.onError = opts.onError;
    this.onConnected = opts.onConnected ?? null;
  }

  /**
   * Kết nối WebSocket và gửi config khởi tạo.
   * avatarId/avatarPath được set trước qua setAvatar().
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.connected) {
        resolve();
        return;
      }

      this.intentionalClose = false;
      this.reconnectAttempts = 0;
      this.doConnect(resolve, reject);
    });
  }

  /** Đặt avatar trước khi connect (hoặc reconnect). */
  setAvatar(avatarId: string, avatarPath: string): void {
    this.avatarId   = avatarId;
    this.avatarPath = avatarPath;
  }

  private doConnect(
    resolve?: () => void,
    reject?: (err: Error) => void,
  ): void {
    this.clearConnectTimer();
    this.clearKeepalive();

    this.connectTimer = setTimeout(() => {
      this.connectTimer = null;
      this.cleanup();
      const err = new Error(`MuseTalk: kết nối timeout sau ${CONNECT_TIMEOUT_MS / 1000}s`);
      reject?.(err);
    }, CONNECT_TIMEOUT_MS);

    this.ws = new WebSocket(WS_URL);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this.clearConnectTimer();
      if (!this.ws) return;
      this.connected = true;
      this.reconnectAttempts = 0;
      this.ws.send(JSON.stringify({ avatar_id: this.avatarId, avatar_path: this.avatarPath }));
      this.startKeepalive();
      resolve?.();
      // Notify cho cả reconnect (resolve chỉ gọi được lần đầu)
      this.onConnected?.();
    };

    this.ws.onmessage = (event: MessageEvent<ArrayBuffer | string>) => {
      if (typeof event.data === 'string') {
        if (event.data === 'CHUNK_DONE') {
          // Short clip: fire bufferReady if not fired yet
          if (!this.bufferReadyFired) {
            this.bufferReadyFired = true;
            this.bufferReadyResolve?.();
            this.bufferReadyResolve = null;
          }
          this.chunkDoneReceived = true;
          this.checkDone();
        }
        return;
      }

      // Binary = JPEG/WebP frame
      this.pendingFrames++;
      this.framesReceived++;

      const frameIndex = this.framesReceived - 1;
      // Server gửi WebP nếu bật, JPEG nếu không — detect bằng magic bytes
      const mime = isWebP(event.data) ? 'image/webp' : 'image/jpeg';
      const blob = new Blob([event.data], { type: mime });
      const frameChunkId = this.chunkId;

      this.onFrame(blob, () => {
        if (this.chunkId !== frameChunkId) return;
        this.pendingFrames--;
        this.checkDone();
      }, frameIndex);

      // Fire bufferReady khi đủ targetFrames (adaptive warmup)
      if (!this.bufferReadyFired && this.framesReceived >= this.bufferTargetFrames) {
        this.bufferReadyFired = true;
        this.bufferReadyResolve?.();
        this.bufferReadyResolve = null;
      }
    };

    this.ws.onerror = (_ev) => {
      this.clearKeepalive();
      this.connected = false;
      if (this.connectTimer !== null) {
        this.clearConnectTimer();
        reject?.(new Error('MuseTalk: WebSocket error'));
      }
      this.onError(new Error('MuseTalk: WebSocket error'));
    };

    this.ws.onclose = () => {
      this.clearKeepalive();
      this.connected = false;
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };
  }

  /**
   * Gửi WAV audio. Returns Promise resolves khi đủ frames đã đến để bắt đầu
   * phát audio đồng bộ (MIN_BUFFER_FRAMES received hoặc CHUNK_DONE).
   */
  /**
   * Gửi WAV audio. Resolve khi đủ `targetFrames` frames đã đến.
   * targetFrames tính từ computeWarmupFrames(audioDuration) để bù deficit
   * server 21fps vs audio 25fps.
   */
  sendAudio(wavBuffer: ArrayBuffer, targetFrames = MIN_BUFFER_FRAMES): Promise<void> {
    if (!this.isConnected) {
      this.onError(new Error('MuseTalk: chưa kết nối, không thể gửi audio'));
      return Promise.resolve();
    }

    this.chunkId++;
    this.pendingFrames = 0;
    this.framesReceived = 0;
    this.chunkDoneReceived = false;
    this.bufferReadyFired = false;
    this.bufferReadyResolve = null;
    this.bufferTargetFrames = Math.max(MIN_BUFFER_FRAMES, targetFrames);

    const bufferReady = new Promise<void>(resolve => {
      this.bufferReadyResolve = resolve;
    });

    this.ws!.send(wavBuffer);
    return bufferReady;
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.clearConnectTimer();
    this.clearKeepalive();
    this.clearReconnectTimer();
    // Unblock any pending bufferReady waiters
    this.bufferReadyResolve?.();
    this.bufferReadyResolve = null;
    this.cleanup();
    this.chunkId++;
    this.pendingFrames = 0;
    this.chunkDoneReceived = false;
  }

  get isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) return;
    if (this.reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      this.onError(new Error(
        `MuseTalk: mất kết nối sau ${RECONNECT_MAX_ATTEMPTS} lần thử lại`,
      ));
      return;
    }

    const delay = RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, delay);
  }

  private startKeepalive(): void {
    this.clearKeepalive();
    this.keepaliveTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // WebSocket ping frame — Starlette/FastAPI xử lý tự động
        this.ws.send(JSON.stringify({ type: 'ping' }));
      } else {
        this.clearKeepalive();
      }
    }, KEEPALIVE_INTERVAL_MS);
  }

  private checkDone(): void {
    if (this.chunkDoneReceived && this.pendingFrames === 0) {
      this.chunkDoneReceived = false;
      this.onDone();
    }
  }

  private clearConnectTimer(): void {
    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  private clearKeepalive(): void {
    if (this.keepaliveTimer !== null) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private cleanup(): void {
    if (!this.ws) return;

    const ws = this.ws;
    this.ws = null;
    this.connected = false;

    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;

    if (ws.readyState === WebSocket.CONNECTING) {
      ws.onopen = () => ws.close();
    } else {
      ws.onopen = null;
      ws.close();
    }
  }
}

/** Phát hiện WebP bằng magic bytes (52 49 46 46 ?? ?? ?? ?? 57 45 42 50) */
function isWebP(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 12) return false;
  const view = new Uint8Array(buffer);
  return (
    view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46 &&
    view[8] === 0x57 && view[9] === 0x45 && view[10] === 0x42 && view[11] === 0x50
  );
}
