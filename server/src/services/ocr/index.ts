/**
 * OCR service — Tesseract.js wrapper chạy offline trong Node.
 *
 * Worker pool: init worker 1 lần rồi reuse (tránh cost load WASM ~500MB RAM
 * mỗi lần). Singleton pattern, lazy init.
 *
 * Privacy: ảnh + text RAM-only — KHÔNG gửi ra khỏi kiosk (khác Google Vision).
 *
 * Language: Vietnamese ('vie') — cần data ~30MB, auto-download lần đầu về
 * ~/.cache/tesseract-data hoặc inline. Offline sau đó.
 */
import { createWorker, type Worker } from 'tesseract.js';

const LANG = 'vie';

let workerPromise: Promise<Worker> | null = null;

/**
 * Lazy init worker singleton. Gọi lần đầu sẽ tốn ~3-5s (load WASM + lang data).
 * Các lần sau < 100ms overhead.
 */
async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker(LANG, 1, {
      logger: () => {
        /* silent — tránh spam log mỗi scan */
      },
    });
  }
  return workerPromise;
}

/**
 * Extract text từ ảnh document. Trả về raw text, caller tự normalize/match.
 *
 * @param input — Buffer ảnh (PNG/JPEG) hoặc base64 data URL hoặc path
 * @returns text OCR — raw, có dấu tiếng Việt, có thể nhiều dòng
 */
export async function extractText(
  input: Buffer | string,
): Promise<{ text: string; confidence: number }> {
  const worker = await getWorker();
  const {
    data: { text, confidence },
  } = await worker.recognize(input);
  return { text: text.trim(), confidence };
}

/**
 * Terminate worker — gọi khi server shutdown. Không bắt buộc, worker sẽ
 * auto-cleanup khi process exit.
 */
export async function shutdown(): Promise<void> {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
  }
}
