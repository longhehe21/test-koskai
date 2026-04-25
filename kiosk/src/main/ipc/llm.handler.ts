import { ipcMain } from 'electron';
import { z } from 'zod';
import { GeminiProvider } from './llm/GeminiProvider';
import type { ChatMessage } from './llm/LLMProvider';

const llmChatSchema = z.object({
  text: z.string().min(1).max(2000),
  /** Lịch sử hội thoại (tuỳ chọn) — backward compatible với call cũ không có history */
  history: z
    .array(z.object({ role: z.enum(['user', 'model']), text: z.string() }))
    .optional(),
  systemPrompt: z.string().optional(),
  /** JSON schema cho structured output (formAiService dùng) */
  responseSchema: z.record(z.unknown()).optional(),
});

const DEFAULT_SYSTEM_PROMPT =
  'Bạn là trợ lý AI tại kiosk hành chính công. Nhiệm vụ của bạn là hướng dẫn công dân ' +
  'thực hiện các thủ tục hành chính một cách nhanh chóng và chính xác. ' +
  'Trả lời ngắn gọn, rõ ràng, lịch sự, bằng tiếng Việt. ' +
  'Nếu không biết câu trả lời, hãy hướng dẫn công dân liên hệ cán bộ trực tiếp.';

function createProvider(): GeminiProvider {
  const apiKey = import.meta.env.MAIN_VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) throw new Error('Missing MAIN_VITE_GEMINI_API_KEY — add it to kiosk/.env');
  return new GeminiProvider(apiKey);
}

export function registerLlmHandlers(): void {
  ipcMain.handle('llm:chat', async (_event, rawInput: unknown) => {
    const { text, history, systemPrompt, responseSchema } = llmChatSchema.parse(rawInput);
    const provider = createProvider();
    return provider.chat(text, {
      systemPrompt: systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      history: history as ChatMessage[] | undefined,
      responseSchema,
    });
  });
}
