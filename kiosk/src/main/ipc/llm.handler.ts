import { ipcMain } from 'electron';
import { z } from 'zod';

const llmChatSchema = z.object({
  text: z.string().min(1).max(2000),
});

const SYSTEM_PROMPT =
  'Bạn là trợ lý AI tại kiosk hành chính công. Nhiệm vụ của bạn là hướng dẫn công dân ' +
  'thực hiện các thủ tục hành chính một cách nhanh chóng và chính xác. ' +
  'Trả lời ngắn gọn, rõ ràng, lịch sự, bằng tiếng Việt. ' +
  'Nếu không biết câu trả lời, hãy hướng dẫn công dân liên hệ cán bộ trực tiếp.';

// TTS giới hạn 5000 ký tự — truncate response trước khi gửi sang TTS
const MAX_RESPONSE_CHARS = 400;

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text: string }> };
  }>;
  error?: { code: number; message: string };
}

const RETRY_STATUS = new Set([429, 500, 503]);
const MAX_RETRIES  = 3;
// Tổng thời gian tối đa: 10s timeout × 3 lần = 30s worst case
const FETCH_TIMEOUT_MS = 10_000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function chatWithGemini(userText: string, attempt = 1): Promise<string> {
  const apiKey = import.meta.env.MAIN_VITE_GEMINI_API_KEY as string | undefined;

  if (!apiKey) {
    throw new Error('Missing MAIN_VITE_GEMINI_API_KEY — add it to kiosk/.env');
  }

  // C2: API key qua header, không phải query string
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
    }),
  });

  if (!response.ok) {
    if (RETRY_STATUS.has(response.status) && attempt < MAX_RETRIES) {
      await sleep(1000 * attempt);
      return chatWithGemini(userText, attempt + 1);
    }
    const body = (await response.json()) as GeminiResponse;
    throw new Error(
      `Gemini API error ${response.status}: ${body.error?.message ?? response.statusText}`,
    );
  }

  const body = (await response.json()) as GeminiResponse;
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini trả về kết quả trống');

  // Truncate để không vượt giới hạn TTS — cắt tại dấu câu gần nhất
  if (text.length <= MAX_RESPONSE_CHARS) return text;
  const cutoff = text.lastIndexOf('.', MAX_RESPONSE_CHARS);
  return cutoff > 0 ? text.slice(0, cutoff + 1) : text.slice(0, MAX_RESPONSE_CHARS);
}

export function registerLlmHandlers(): void {
  ipcMain.handle('llm:chat', async (_event, rawInput: unknown) => {
    const { text } = llmChatSchema.parse(rawInput);
    return chatWithGemini(text);
  });
}
