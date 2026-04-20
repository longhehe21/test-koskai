/**
 * MuseTalkCanvas — hiển thị avatar với hai chế độ:
 *
 * IDLE    — <video> loop hiển thị trực tiếp (visible, opacity=1)
 * SPEAKING — <canvas> overlay hiển thị JPEG/WebP frames từ MuseTalk (opacity=1),
 *            video ẩn (opacity=0)
 *
 * Lip-sync timing: dùng AudioContext.currentTime làm clock anchor (chính xác hơn
 * performance.now()) — caller truyền audioCtx + startAt vào startSync().
 *
 * Cover draw: scale = Math.max(cw/bm.width, ch/bm.height) → crop center, không squish.
 * MuseTalk frames 720×1280 (9:16) trên canvas vuông → crop dọc để lấy phần mặt.
 *
 * Sequential decode queue: createImageBitmap chạy tuần tự qua Promise chain.
 * Tránh Chromium block khi quá nhiều concurrent decode ops ở 25fps.
 */

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

export interface MuseTalkCanvasHandle {
  addFrame: (blob: Blob, onRendered: () => void, frameIndex: number) => void;
  /** getElapsedMs: hàm trả về số ms đã phát audio (dùng audio.currentTime * 1000) */
  startSync: (getElapsedMs: () => number) => void;
  clearAndShowIdle: () => void;
}

interface MuseTalkCanvasProps {
  idleVideoUrl?: string;
  className?: string;
}

const FPS = 25;
const FRAME_DURATION_MS = 1000 / FPS;

interface DecodedFrame {
  frameIndex: number;
  bitmap: ImageBitmap;
  onRendered: () => void;
}

export const MuseTalkCanvas = forwardRef<MuseTalkCanvasHandle, MuseTalkCanvasProps>(
  ({ idleVideoUrl, className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [isSpeaking, setIsSpeaking] = useState(false);

    // Sync state — tất cả dùng refs để tránh stale closure trong RAF callbacks
    const getElapsedRef = useRef<(() => number) | null>(null);
    const rafRef       = useRef<number | null>(null);
    // Tăng khi clearAndShowIdle() → stale decode results bị discard
    const clearIdRef   = useRef(0);
    // Sequential decode queue — tránh concurrent createImageBitmap
    const decodeQueue  = useRef<Promise<void>>(Promise.resolve());
    const decodedRef   = useRef<DecodedFrame[]>([]);
    const runningRef   = useRef(false);

    // ── Draw helpers ────────────────────────────────────────────────────────

    function drawCover(bitmap: ImageBitmap): void {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) return;
      const { width: cw, height: ch } = canvas;
      // Math.max = object-fit:cover, crop center
      const scale = Math.max(cw / bitmap.width, ch / bitmap.height);
      const sw = cw / scale;
      const sh = ch / scale;
      const sx = (bitmap.width - sw) / 2;
      const sy = (bitmap.height - sh) / 2;
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, cw, ch);
    }

    // ── RAF tick (SPEAKING mode) ─────────────────────────────────────────────

    function tick(): void {
      if (!runningRef.current) return;
      rafRef.current = null;

      const getElapsed = getElapsedRef.current;
      if (getElapsed) {
        const elapsed = getElapsed();
        const targetFrame = Math.floor(elapsed / FRAME_DURATION_MS);
        const decoded = decodedRef.current;

        if (decoded.length > 0) {
          const toConsume: DecodedFrame[] = [];
          const remaining: DecodedFrame[] = [];

          for (const f of decoded) {
            if (f.frameIndex <= targetFrame) toConsume.push(f);
            else remaining.push(f);
          }

          if (toConsume.length > 0) {
            decodedRef.current = remaining;
            // Vẽ frame mới nhất, skip các frame cũ khi lag
            const drawFrame = toConsume.reduce((a, b) =>
              a.frameIndex > b.frameIndex ? a : b,
            );
            drawCover(drawFrame.bitmap);
            for (const f of toConsume) {
              f.bitmap.close();
              f.onRendered();
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    // ── Public API ──────────────────────────────────────────────────────────

    useImperativeHandle(ref, () => ({
      addFrame: (blob, onRendered, frameIndex) => {
        const capturedClearId = clearIdRef.current;

        // Sequential: chờ decode op trước xong mới decode tiếp
        decodeQueue.current = decodeQueue.current.then(async () => {
          if (clearIdRef.current !== capturedClearId) {
            onRendered();
            return;
          }
          try {
            const bitmap = await createImageBitmap(blob);
            if (clearIdRef.current !== capturedClearId) {
              bitmap.close();
              onRendered();
              return;
            }
            // Insertion sort by frameIndex để đảm bảo thứ tự đúng
            const frames = decodedRef.current;
            const insertAt = frames.findIndex(f => f.frameIndex > frameIndex);
            const entry: DecodedFrame = { frameIndex, bitmap, onRendered };
            if (insertAt === -1) frames.push(entry);
            else frames.splice(insertAt, 0, entry);
          } catch {
            onRendered();
          }
        });
      },

      startSync: (getElapsedMs: () => number) => {
        getElapsedRef.current = getElapsedMs;
        runningRef.current = true;
        setIsSpeaking(true);
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(tick);
        }
      },

      clearAndShowIdle: () => {
        runningRef.current = false;
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        // H3: reset decode queue để tránh chain grow vô hạn giữa các session
        decodeQueue.current = Promise.resolve();
        clearIdRef.current++;
        // Giải phóng tất cả frames còn trong queue
        const frames = decodedRef.current;
        decodedRef.current = [];
        for (const f of frames) {
          f.bitmap.close();
          f.onRendered();
        }
        getElapsedRef.current = null;
        setIsSpeaking(false);
      },
    }));

    return (
      <div className={`relative overflow-hidden ${className ?? 'h-full w-full'}`}>
        {idleVideoUrl && (
          <video
            src={idleVideoUrl}
            autoPlay
            loop
            muted
            playsInline
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ${
              isSpeaking ? 'opacity-0' : 'opacity-100'
            }`}
          />
        )}
        <canvas
          ref={canvasRef}
          width={720}
          height={1280}
          className={`absolute inset-0 h-full w-full transition-opacity duration-150 ${
            isSpeaking ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ display: 'block' }}
        />
      </div>
    );
  },
);

MuseTalkCanvas.displayName = 'MuseTalkCanvas';
