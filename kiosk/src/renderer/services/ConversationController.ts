import { MicrophoneCapture } from './MicrophoneCapture';
import { MuseTalkClient, isMuseTalkConfigured, type MuseTalkFrameCallback } from './MuseTalkClient';
import type { ConversationState } from '@store/conversationStore';

// Env optional — nếu chưa cấu hình, MuseTalk tắt mềm, UI vẫn load bình thường.
const MUSETALK_URL   = import.meta.env.RENDERER_VITE_MUSETALK_URL as string | undefined;
const MUSETALK_TOKEN = import.meta.env.RENDERER_VITE_MUSETALK_TOKEN as string | undefined;

const HTTP_BASE = MUSETALK_URL
  ? MUSETALK_URL.replace(/^ws/, 'http').replace('/avatar', '')
  : null;

export type { ConversationState };

// ── Adaptive warmup ─────────────────────────────────────────────────────────
const AUDIO_FPS = 25;
// Server hiện tại 24fps sau các optimization, deficit rất nhỏ
const ESTIMATED_INFERENCE_FPS = 24;
const MIN_WARMUP_FRAMES = 4;
const SAFETY_FRAMES = 2;

function computeWarmupFrames(audioDurationSec: number): number {
  const totalFrames = Math.ceil(audioDurationSec * AUDIO_FPS);
  const deficit = Math.max(0, totalFrames * (1 - ESTIMATED_INFERENCE_FPS / AUDIO_FPS));
  return Math.max(MIN_WARMUP_FRAMES, Math.ceil(deficit) + SAFETY_FRAMES);
}

// Tăng timeout để đợi feat+first batch kể cả lần đầu sau restart (feat~3.5s)
const BUFFER_WAIT_TIMEOUT_MS = 6_000;
const RESTART_DELAY_MS       = 800;
/**
 * Độ trễ OS audio output trên Windows (~60ms).
 * audio.play() resolve ngay nhưng tiếng thực ra loa sau khoảng này.
 * Canvas lùi đồng hồ lại để môi không chạy trước tiếng.
 */
const AUDIO_OUTPUT_LATENCY_MS = 60;

const GREETING_TEXT =
  'Xin chào! Tôi là trợ lý ảo hành chính công. ' +
  'Tôi có thể giúp bạn tìm hiểu và thực hiện các thủ tục hành chính. ' +
  'Bạn cần hỗ trợ gì hôm nay?';

export interface ConversationEvents {
  onStateChange:    (state: ConversationState) => void;
  onTranscript:     (text: string) => void;
  onResponse:       (text: string) => void;
  onError:          (message: string) => void;
  onMuseTalkStatus: (status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'unconfigured') => void;
  onFrame:          MuseTalkFrameCallback;
  /** getElapsedMs trả về ms đã phát — dùng audio.currentTime * 1000 */
  onStartSync:      (getElapsedMs: () => number) => void;
  onSpeakingDone:   () => void;
}

export class ConversationController {
  private _state: ConversationState = 'IDLE';
  private readonly mic:      MicrophoneCapture;
  private readonly events:   ConversationEvents;
  private readonly musetalk: MuseTalkClient;
  private readonly configured: boolean;

  private audio = new Audio();
  private currentWavUrl: string | null = null;

  // H1: disposed flag — mọi async callback kiểm tra trước khi tiếp tục
  private disposed = false;
  // begin() chỉ chạy một lần
  private started = false;
  // tránh double-start listening
  private startingListen = false;

  constructor(events: ConversationEvents) {
    this.events = events;
    this.mic = new MicrophoneCapture();
    this.configured = isMuseTalkConfigured();

    this.musetalk = new MuseTalkClient({
      onFrame: events.onFrame,
      onDone:  () => { /* audio.onended xử lý transition */ },
      onConnected: () => { events.onMuseTalkStatus('connected'); },
      onError: (err) => {
        events.onMuseTalkStatus('error');
        this.handleError('MuseTalk lỗi', err);
      },
    });

    if (!this.configured) {
      events.onMuseTalkStatus('unconfigured');
      return;
    }

    events.onMuseTalkStatus('connecting');
    void this.initMuseTalk();
  }

  // ── Init MuseTalk ───────────────────────────────────────────────────────

  private async initMuseTalk(): Promise<void> {
    if (!HTTP_BASE || !MUSETALK_TOKEN) return;  // guarded by this.configured, nhưng narrow type cho TS
    try {
      const res = await fetch(`${HTTP_BASE}/next_idle`, {
        signal: AbortSignal.timeout(5_000),
        headers: { Authorization: `Bearer ${MUSETALK_TOKEN}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { avatar_id: string; avatar_path: string };
        this.musetalk.setAvatar(data.avatar_id, data.avatar_path);
      }
    } catch { /* fallback default avatar */ }

    // Nếu bị dispose trong lúc fetch (StrictMode cleanup), không connect nữa
    if (this.disposed) return;

    this.musetalk.connect()
      .catch(() => {
        if (!this.disposed) this.events.onMuseTalkStatus('error');
      });
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Gọi một lần sau khi user tap. AI chào → lắng nghe vô hạn. */
  begin(): void {
    if (this.started || this.disposed || !this.configured) return;
    this.started = true;
    console.log('[CC] begin()');
    void this.speakThenListen(GREETING_TEXT);
  }

  get state(): ConversationState { return this._state; }

  dispose(): void {
    // H1: đặt flag trước — tất cả async callbacks sẽ abort
    this.disposed = true;
    this.mic.dispose();
    this.stopAudio();
    this.musetalk.disconnect();
  }

  // ── Conversation loop ───────────────────────────────────────────────────

  async startListening(): Promise<void> {
    if (this.disposed) return;
    if (this._state !== 'IDLE') { console.log(`[CC] startListening skip — state=${this._state}`); return; }
    if (this.startingListen) { console.log('[CC] startListening skip — already starting'); return; }
    this.startingListen = true;
    console.log('[CC] startListening…');

    try {
      await this.mic.start(() => void this.stopListening());
      if (this.disposed) return;
      this.transition('LISTENING');
      console.log('[CC] LISTENING');
    } catch (err) {
      console.error('[CC] mic.start() error:', err);
      this.handleError('Không thể truy cập microphone', err);
    } finally {
      this.startingListen = false;
    }
  }

  async stopListening(): Promise<void> {
    if (this.disposed) return;
    if (this._state !== 'LISTENING') return;
    console.log('[CC] VAD triggered → stopListening');
    this.transition('PROCESSING');

    try {
      // Bước 1: STT
      const transcript = await this.mic.stop();
      if (this.disposed) return;
      console.log(`[CC] STT transcript="${transcript}"`);

      if (!transcript.trim()) {
        console.log('[CC] empty transcript → restart listening');
        this.events.onTranscript('');
        this.events.onResponse('');
        this.transition('IDLE');
        this.restartListening();
        return;
      }
      this.events.onTranscript(transcript);

      // Bước 2: LLM
      const response = (await window.electronAPI.invoke('llm:chat', {
        text: transcript,
      })) as string;
      if (this.disposed) return;
      this.events.onResponse(response);

      // Bước 3: TTS + phát
      await this.speakThenListen(response);
    } catch (err) {
      this.handleError('Lỗi trong quá trình xử lý', err);
    }
  }

  // ── Core: TTS → MuseTalk → HTMLAudio → tự lắng nghe lại ────────────────

  private async speakThenListen(text: string): Promise<void> {
    if (this.disposed) return;
    this.transition('SPEAKING');
    console.log(`[CC] speakThenListen text="${text.slice(0, 40)}…"`);

    try {
      // TTS
      console.log('[CC] calling tts:speak…');
      const raw = (await window.electronAPI.invoke('tts:speak', { text })) as Uint8Array;
      if (this.disposed) return;
      console.log(`[CC] tts:speak ok — ${raw.byteLength} bytes`);

      const wavBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);

      // Tính số frames cần buffer dựa trên WAV duration
      // WAV LINEAR16 16kHz: byteLength = sampleRate * channels * bytesPerSample * duration
      const audioDurationSec = (wavBuffer.byteLength - 44) / (16000 * 2);
      const targetFrames     = computeWarmupFrames(audioDurationSec);
      console.log(`[CC] audio ~${audioDurationSec.toFixed(1)}s → warmup ${targetFrames} frames`);

      // Gửi WAV lên MuseTalk, chờ đủ warmup frames
      if (this.musetalk.isConnected) {
        console.log('[CC] sendAudio → waiting bufferReady…');
        const bufferReady = this.musetalk.sendAudio(wavBuffer, targetFrames);
        await Promise.race([
          bufferReady,
          new Promise<void>(r => setTimeout(r, BUFFER_WAIT_TIMEOUT_MS)),
        ]);
        console.log('[CC] bufferReady resolved');
      }
      if (this.disposed) return;

      console.log('[CC] playAudio()');
      this.playAudio(wavBuffer);
    } catch (err) {
      console.error('[CC] speakThenListen error:', err);
      this.handleError('Lỗi TTS/phát âm', err);
    }
  }

  private playAudio(wavBuffer: ArrayBuffer): void {
    if (this.disposed) return;
    this.stopAudio();

    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    const url  = URL.createObjectURL(blob);
    this.currentWavUrl = url;

    // Bug fix: onended TRƯỚC khi set src + play() để không bị miss event
    this.audio.onended = () => {
      if (this.disposed) return;
      console.log('[CC] audio.onended → startListening');
      this.audio.onended = null;
      this.stopAudio();
      this.events.onSpeakingDone();
      this.transition('IDLE');
      void this.startListening();
    };

    this.audio.onerror = () => {
      if (this.disposed) return;
      const err = this.audio.error;
      console.error('[CC] audio error code=', err?.code, err?.message);
      this.audio.onerror = null;
      this.handleError('Không thể phát audio', new Error(`MediaError code=${err?.code}`));
    };

    // Đặt src SAU khi handlers đã set — tránh race condition
    this.audio.src = url;

    this.audio.play().then(() => {
      if (this.disposed) return;
      console.log('[CC] audio.play() ok, duration=', this.audio.duration?.toFixed(1), 's');
      // Bù AUDIO_OUTPUT_LATENCY_MS: canvas bắt đầu từ -60ms để môi khớp tiếng
      const startedAt = performance.now();
      this.events.onStartSync(() => {
        const wallElapsed = performance.now() - startedAt;
        return Math.max(0, wallElapsed - AUDIO_OUTPUT_LATENCY_MS);
      });
    }).catch((err: unknown) => {
      console.error('[CC] audio.play() rejected:', err);
      this.handleError('Không thể phát audio', err);
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private stopAudio(): void {
    // Xóa handlers trước khi dừng để tránh trigger lại
    this.audio.onended = null;
    this.audio.onerror = null;
    try { this.audio.pause(); } catch { /* ignore */ }
    // KHÔNG set src='' — gây Chromium error state, làm play() bị reject lần sau
    // Chỉ revoke blob URL để giải phóng memory
    if (this.currentWavUrl) {
      URL.revokeObjectURL(this.currentWavUrl);
      this.currentWavUrl = null;
    }
  }

  private transition(next: ConversationState): void {
    if (this.disposed) return;
    this._state = next;
    this.events.onStateChange(next);
  }

  private restartListening(): void {
    if (this.disposed) return;
    setTimeout(() => void this.startListening(), RESTART_DELAY_MS);
  }

  private handleError(message: string, err: unknown): void {
    if (this.disposed) return;
    const detail = err instanceof Error ? err.message : String(err);
    this.events.onError(`${message}: ${detail}`);
    this.stopAudio();
    this.events.onSpeakingDone();
    this.transition('IDLE');
    this.restartListening();
  }
}

