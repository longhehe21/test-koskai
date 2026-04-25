export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ChatOptions {
  systemPrompt?: string;
  history?: ChatMessage[];
  /** JSON schema cho structured output — nếu có, provider bật JSON mode */
  responseSchema?: object;
  maxOutputTokens?: number;
  temperature?: number;
}

export interface LLMProvider {
  /** Gửi tin nhắn, trả về text response (hoặc JSON string khi dùng responseSchema). */
  chat(userText: string, options?: ChatOptions): Promise<string>;
}
