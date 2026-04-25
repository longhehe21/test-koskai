import { createWorker, type Worker } from 'tesseract.js';

const LANG = 'vie';
let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker(LANG, 1, {
      logger: () => { /* silent */ },
    });
  }
  return workerPromise;
}

export async function extractText(
  input: Buffer | string,
): Promise<{ text: string; confidence: number }> {
  const worker = await getWorker();
  const { data: { text, confidence } } = await worker.recognize(input);
  return { text: text.trim(), confidence };
}

export async function shutdown(): Promise<void> {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
  }
}
