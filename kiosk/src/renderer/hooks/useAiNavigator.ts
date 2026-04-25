/**
 * useAiNavigator — đăng ký AI transcript override cho các page chọn card.
 *
 * Nhận danh sách options, trả về transcriptOverride phân loại câu nói
 * thành option tương ứng rồi trigger onSelect.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useAi } from '@renderer/providers/AiProvider';
import { useFormAiStore } from '@store/formAiStore';

export interface NavOption {
  /** ID option (code trong store) */
  id: string;
  /** Nhãn hiển thị */
  label: string;
  /** Từ khóa/aliases để AI match (lowercase) */
  keywords: string[];
}

interface UseAiNavigatorOptions {
  /** Danh sách lựa chọn trên trang */
  options: NavOption[];
  /** Câu AI chào khi vào trang (sẽ tự nói lại nếu chưa nói) */
  greeting: string;
  /** Callback khi AI xác định được option */
  onSelect: (id: string) => void;
  /** Câu AI nói khi không nhận ra intent */
  fallbackReply?: string;
}

const INTENT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    selected_id: { type: 'STRING', description: 'ID option phù hợp nhất, hoặc empty string nếu không nhận ra' },
    confidence: { type: 'NUMBER' },
  },
  required: ['selected_id', 'confidence'],
};

export function useAiNavigator({
  options,
  greeting,
  onSelect,
  fallbackReply,
}: UseAiNavigatorOptions) {
  const { setTranscriptOverride } = useAi();
  const { addTurn } = useFormAiStore();
  const greetedRef = useRef(false);

  const handleTranscript = useCallback(
    async (transcript: string): Promise<string> => {
      const history = useFormAiStore.getState().history;
      addTurn({ role: 'user', text: transcript });

      const optionList = options
        .map((o) => `- "${o.id}": ${o.label} (từ khóa: ${o.keywords.join(', ')})`)
        .join('\n');

      const prompt =
        `Người dùng nói: "${transcript}"\n\n` +
        `Các lựa chọn:\n${optionList}\n\n` +
        'Chọn option phù hợp nhất. Nếu không rõ, trả về selected_id rỗng.';

      let selectedId = '';
      let confidence = 0;

      try {
        const raw = (await window.electronAPI.invoke('llm:chat', {
          text: prompt,
          history,
          responseSchema: INTENT_SCHEMA,
        })) as string;
        const parsed = JSON.parse(raw) as { selected_id: string; confidence: number };
        selectedId = parsed.selected_id;
        confidence = parsed.confidence;
      } catch {
        // JSON parse fail — thử keyword match đơn giản
        const lower = transcript.toLowerCase();
        for (const opt of options) {
          if (opt.keywords.some((kw) => lower.includes(kw))) {
            selectedId = opt.id;
            confidence = 0.8;
            break;
          }
        }
      }

      if (selectedId && confidence >= 0.7) {
        const matched = options.find((o) => o.id === selectedId);
        const reply = matched
          ? `Được rồi ạ, em chọn "${matched.label}" cho anh.`
          : 'Đang chuyển trang…';
        addTurn({ role: 'model', text: reply });
        // Delay nhỏ để TTS có thể nói xong một phần trước khi navigate
        setTimeout(() => onSelect(selectedId), 900);
        return reply;
      }

      const fallback =
        fallbackReply ??
        `Anh vui lòng chọn một trong các mục: ${options.map((o) => o.label).join(', ')}.`;
      addTurn({ role: 'model', text: fallback });
      return fallback;
    },
    [options, onSelect, fallbackReply, addTurn],
  );

  useEffect(() => {
    setTranscriptOverride(handleTranscript);
    return () => setTranscriptOverride(null);
  }, [handleTranscript, setTranscriptOverride]);

  // Trả về greeting text để page có thể kích hoạt AI nói khi vào trang
  return { greeting, greetedRef };
}
