import type { LLMProvider, ChatOptions, ChatMessage } from './LLMProvider';

interface GeminiPart { text: string }
interface GeminiContent { role: string; parts: GeminiPart[] }
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
  error?: { code: number; message: string };
}

const RETRY_STATUS = new Set([429, 500, 503]);
const MAX_RETRIES = 3;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_CHARS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncateAtSentence(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cutoff = text.lastIndexOf('.', limit);
  return cutoff > 0 ? text.slice(0, cutoff + 1) : text.slice(0, limit);
}

export class GeminiProvider implements LLMProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model = 'gemini-2.5-flash') {
    if (!apiKey) throw new Error('GeminiProvider: apiKey là bắt buộc');
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(userText: string, options: ChatOptions = {}, attempt = 1): Promise<string> {
    const {
      systemPrompt,
      history = [],
      responseSchema,
      maxOutputTokens = 512,
      temperature = 0.7,
    } = options;

    const contents: GeminiContent[] = [
      ...history.map((m: ChatMessage) => ({ role: m.role, parts: [{ text: m.text }] })),
      { role: 'user', parts: [{ text: userText }] },
    ];

    const generationConfig: Record<string, unknown> = { maxOutputTokens, temperature };
    if (responseSchema) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseSchema = responseSchema;
    }

    const body: Record<string, unknown> = { contents, generationConfig };
    if (systemPrompt) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;

    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (RETRY_STATUS.has(response.status) && attempt < MAX_RETRIES) {
        await sleep(1000 * attempt);
        return this.chat(userText, options, attempt + 1);
      }
      const err = (await response.json()) as GeminiResponse;
      throw new Error(`Gemini ${response.status}: ${err.error?.message ?? response.statusText}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini trả về kết quả trống');

    // Không truncate khi dùng JSON mode — cần full JSON
    if (responseSchema) return text;
    return truncateAtSentence(text, MAX_RESPONSE_CHARS);
  }
}
