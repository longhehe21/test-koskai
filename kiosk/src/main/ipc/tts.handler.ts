import { ipcMain } from 'electron';
import { z } from 'zod';

const ttsRequestSchema = z.object({
  text: z.string().min(1).max(5000),
  voice: z.string().optional().default('vi-VN-Neural2-A'),
});

interface GoogleTtsResponse {
  audioContent: string;
  error?: { code: number; message: string; status: string };
}

const SAMPLE_RATE = 16_000;
const FETCH_TIMEOUT_MS = 15_000;

async function synthesizeSpeech(text: string, voice: string): Promise<Buffer> {
  const apiKey = import.meta.env.MAIN_VITE_GOOGLE_TTS_API_KEY as string | undefined;
  if (!apiKey) throw new Error('Missing MAIN_VITE_GOOGLE_TTS_API_KEY');

  // Google Cloud TTS v1 dùng ?key= query param (không phải x-goog-api-key header)
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: 'vi-VN', name: voice },
      // LINEAR16: Google TTS trả về WAV đầy đủ (RIFF header + PCM 16-bit 16kHz)
      audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: SAMPLE_RATE },
    }),
  });

  if (!response.ok) {
    const body = (await response.json()) as GoogleTtsResponse;
    throw new Error(`TTS ${response.status}: ${body.error?.message ?? response.statusText}`);
  }

  const { audioContent } = (await response.json()) as GoogleTtsResponse;
  return Buffer.from(audioContent, 'base64');
}

export function registerTtsHandlers(): void {
  ipcMain.handle('tts:speak', async (_event, rawInput: unknown) => {
    const { text, voice } = ttsRequestSchema.parse(rawInput);
    return synthesizeSpeech(text, voice);
  });
}
