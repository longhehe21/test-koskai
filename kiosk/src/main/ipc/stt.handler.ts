import { ipcMain } from 'electron';
import { z } from 'zod';

const sttChunkSchema = z.object({
  audio: z.instanceof(Uint8Array),
});

// Per-sender session isolation
const sessions = new Map<number, Buffer[]>();

interface GoogleSttResponse {
  results?: Array<{
    alternatives?: Array<{ transcript: string; confidence: number }>;
  }>;
  error?: { code: number; message: string };
}

async function transcribeBuffer(combined: Buffer): Promise<string> {
  const apiKey = import.meta.env.MAIN_VITE_GOOGLE_TTS_API_KEY as string | undefined;
  if (!apiKey) throw new Error('Missing MAIN_VITE_GOOGLE_TTS_API_KEY');

  // Google Cloud STT v1 dùng ?key= query param
  const url = `https://speech.googleapis.com/v1/speech:recognize?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: 'vi-VN',
        model: 'latest_long',
        enableAutomaticPunctuation: true,
      },
      audio: { content: combined.toString('base64') },
    }),
  });

  const body = (await response.json()) as GoogleSttResponse;
  if (!response.ok) {
    throw new Error(`STT ${response.status}: ${body.error?.message ?? response.statusText}`);
  }

  return body.results?.[0]?.alternatives?.[0]?.transcript ?? '';
}

export function registerSttHandlers(): void {
  ipcMain.handle('stt:start', (event) => {
    sessions.set(event.sender.id, []);
  });

  ipcMain.handle('stt:chunk', (event, rawInput: unknown) => {
    const buf = sessions.get(event.sender.id);
    if (!buf) return;
    const { audio } = sttChunkSchema.parse(rawInput);
    buf.push(Buffer.from(audio));
  });

  ipcMain.handle('stt:stop', async (event) => {
    const buf = sessions.get(event.sender.id) ?? [];
    sessions.delete(event.sender.id);
    if (buf.length === 0) return '';
    return transcribeBuffer(Buffer.concat(buf));
  });
}
