/**
 * formAiService — AI-powered form filling qua Gemini.
 *
 * Luồng: userText → extractFieldValue (JSON mode) → FilledField
 * Chạy hoàn toàn ở renderer, gọi IPC llm:chat sang main process.
 */

import type { ConversationTurn, FilledField, PersonaAddress } from '@store/formAiStore';
import { jsonrepair } from 'jsonrepair';

// Confidence thresholds theo loại field (từ AI_IMPLEMENTATION_PLAN.md)
export const CONFIDENCE_THRESHOLD: Record<string, number> = {
  sdt: 0.85,
  hoTen: 0.70,
  ngaySinh: 0.80,
  diaChi: 0.60,
  enum: 0.75,
};

/** Định nghĩa một field form mà AI có thể fill. */
export interface FieldDef {
  key: string;
  label: string;
  /** 'text' | 'date' | 'phone' | 'enum' | 'address' */
  type: 'text' | 'date' | 'phone' | 'enum' | 'address';
  enumValues?: string[];
  /** Gợi ý thêm cho AI (ví dụ: format mong muốn) */
  hint?: string;
}

interface ExtractResult {
  value: string;
  confidence: number;
  needs_clarification: boolean;
}

/** System prompt cho extract — chi tiết trong docs/prompts/extract-field.txt */
const EXTRACT_SYSTEM_PROMPT = `Bạn là AI extract thông tin từ giọng nói để điền form hành chính Việt Nam.
Quy tắc bắt buộc:
- Trả về JSON đúng schema, không giải thích thêm.
- phone: chuẩn hóa thành 10 chữ số bắt đầu bằng 0. "không chín tám..." → "0987...". Thiếu số → confidence < 0.5.
- date: chuẩn hóa thành dd/mm/yyyy. "ba mươi tháng mười hai năm hai nghìn hai lăm" → "30/12/2025".
- text (họ tên): IN HOA toàn bộ, xử lý dấu thanh tiếng Việt.
- enum: fuzzy match về giá trị hợp lệ gần nhất. "vợ tôi" → "Vợ/Chồng".
- Nếu người dùng nói "bỏ qua" / "không biết" / "để sau" → value="" confidence=0 needs_clarification=false.
- Nếu không đủ thông tin → needs_clarification=true.`;

const EXTRACT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    value: { type: 'STRING', description: 'Giá trị extracted, empty string nếu không tìm thấy' },
    confidence: { type: 'NUMBER', description: '0.0 đến 1.0' },
    needs_clarification: { type: 'BOOLEAN', description: 'true nếu cần hỏi lại' },
  },
  required: ['value', 'confidence', 'needs_clarification'],
};

/**
 * Extract giá trị một field từ câu nói của người dùng.
 * Retry 1 lần nếu JSON parse fail → dùng jsonrepair → fallback needs_clarification.
 */
export async function extractFieldValue(
  userText: string,
  field: FieldDef,
  history: ConversationTurn[],
): Promise<FilledField> {
  const enumHint = field.enumValues?.length
    ? `\nGiá trị hợp lệ: ${field.enumValues.join(', ')}`
    : '';

  const prompt =
    `Field cần extract: "${field.label}" (key: ${field.key}, type: ${field.type})` +
    (field.hint ? `\nGợi ý: ${field.hint}` : '') +
    enumHint +
    `\n\nCâu người dùng: "${userText}"`;

  const raw = await callLlm(prompt, history, EXTRACT_SCHEMA, EXTRACT_SYSTEM_PROMPT);
  const result = parseExtractResult(raw);

  const threshold = CONFIDENCE_THRESHOLD[field.type === 'enum' ? 'enum' : field.key] ??
    CONFIDENCE_THRESHOLD.diaChi;

  return {
    fieldKey: field.key,
    value: result.needs_clarification || result.confidence < threshold ? '' : result.value,
    confidence: result.confidence,
  };
}

const GENERATE_SYSTEM_PROMPT = `Bạn là trợ lý AI tại kiosk hành chính công, hỗ trợ điền form qua giọng nói.
Quy tắc:
- Tối đa 2 câu, khoảng 20–50 từ. Ngắn gọn, tự nhiên như người thật.
- Không dùng markdown, bullet, ký hiệu đặc biệt.
- Khi confirm: đọc lại giá trị đã lưu để người dùng kiểm tra.
- Khi hỏi tiếp: chỉ hỏi 1 field, không hỏi nhiều cùng lúc.
- Khi cần làm rõ: giải thích format ngắn gọn bằng ví dụ số cụ thể.
- Xưng hô theo persona được chỉ định trong system prompt.`;

/**
 * Sinh câu phản hồi tự nhiên — dẫn dắt người dùng điền field tiếp theo.
 */
export async function generateResponse(
  context: string,
  persona: PersonaAddress,
  history: ConversationTurn[],
  wasInterrupted: boolean,
): Promise<string> {
  const interruptedNote = wasInterrupted
    ? '\n[Lưu ý: câu trả lời trước bị ngắt — bắt đầu lại tự nhiên]'
    : '';

  const systemPrompt =
    GENERATE_SYSTEM_PROMPT +
    `\nXưng hô: gọi người dùng là "${persona}".` +
    interruptedNote;

  const text = await callLlm(context, history, undefined, systemPrompt);
  return text;
}

/** Intent navigation — detect khi người dùng muốn sang bước khác. */
export type NavigationIntent =
  | 'next_field'
  | 'prev_field'
  | 'next_section'
  | 'prev_section'
  | 'submit'
  | 'cancel'
  | 'none';

const INTENT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    intent: {
      type: 'STRING',
      enum: ['next_field', 'prev_field', 'next_section', 'prev_section', 'submit', 'cancel', 'none'],
    },
    confidence: { type: 'NUMBER' },
  },
  required: ['intent', 'confidence'],
};

export async function detectNavigationIntent(
  userText: string,
  history: ConversationTurn[],
): Promise<NavigationIntent> {
  const prompt =
    `Người dùng nói: "${userText}"\n` +
    'Xác định intent điều hướng form. Chỉ detect intent rõ ràng (confidence >= 0.75).';

  const raw = await callLlm(prompt, history, INTENT_SCHEMA);

  try {
    const parsed = JSON.parse(raw) as { intent: NavigationIntent; confidence: number };
    if (parsed.confidence >= 0.75) return parsed.intent;
  } catch {
    // ignore parse error — trả về none
  }
  return 'none';
}

// ─── Internal helpers ───────────────────────────────────────────────────────

async function callLlm(
  userText: string,
  history: ConversationTurn[],
  responseSchema?: object,
  systemPrompt?: string,
): Promise<string> {
  return window.electronAPI.invoke('llm:chat', {
    text: userText,
    history,
    systemPrompt,
    responseSchema,
  }) as Promise<string>;
}

function parseExtractResult(raw: string): ExtractResult {
  try {
    return JSON.parse(raw) as ExtractResult;
  } catch {
    // Thử repair
    try {
      return JSON.parse(jsonrepair(raw)) as ExtractResult;
    } catch {
      return { value: '', confidence: 0, needs_clarification: true };
    }
  }
}
