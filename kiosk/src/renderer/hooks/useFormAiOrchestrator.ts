/**
 * useFormAiOrchestrator — AI guided form filling, generic cho mọi form.
 *
 * Usage:
 *   const [aiActive, setAiActive] = useState(false);
 *   useFormAiOrchestrator({ fields: MY_FIELDS, setters, active: aiActive, onFallbackKeyboard });
 */

import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAi } from '@renderer/providers/AiProvider';
import { useFormAiStore, resolvePersona } from '@store/formAiStore';
import { useSessionUserStore } from '@store/sessionUserStore';
import {
  extractFieldValue,
  generateResponse,
  detectNavigationIntent,
  CONFIDENCE_THRESHOLD,
  type FieldDef,
} from '@services/formAiService';

const MAX_RETRIES = 2;

interface UseFormAiOrchestratorOptions {
  /** Danh sách field AI sẽ hỏi theo thứ tự */
  fields: FieldDef[];
  /** Map fieldKey → setter function */
  setters: Record<string, (v: string) => void>;
  /** Khi true: AI đang hỗ trợ nhập liệu */
  active: boolean;
  /** Gọi khi AI không nghe rõ >= MAX_RETRIES lần → fallback bàn phím */
  onFallbackKeyboard: (fieldKey: string | null) => void;
}

export function useFormAiOrchestrator({
  fields,
  setters,
  active,
  onFallbackKeyboard,
}: UseFormAiOrchestratorOptions) {
  const { setTranscriptOverride, speakText } = useAi();
  const navigate = useNavigate();
  const { addTurn, setFilledField, wasInterrupted, setWasInterrupted, reset: resetStore } = useFormAiStore();
  const retryRef = useRef<Record<string, number>>({});

  // ── Transcript handler ────────────────────────────────────────────────────
  const handleTranscript = useCallback(
    async (transcript: string): Promise<string> => {
      const store = useFormAiStore.getState();
      const history = store.history;
      addTurn({ role: 'user', text: transcript });

      // 1. Navigation intent
      const intent = await detectNavigationIntent(transcript, history);
      if (intent === 'submit') {
        const reply = `Em đã lưu thông tin rồi ạ. Anh nhấn "Nộp" để hoàn tất nhé.`;
        addTurn({ role: 'model', text: reply });
        return reply;
      }
      if (intent === 'cancel' || intent === 'prev_section' || intent === 'prev_field') {
        const reply = 'Được rồi ạ. Em đưa anh quay lại bước trước.';
        addTurn({ role: 'model', text: reply });
        setTimeout(() => navigate(-1), 1200);
        return reply;
      }

      // 2. Tìm field chưa fill
      const currentFilled = useFormAiStore.getState().filledFields;
      const nextField = fields.find((f) => !currentFilled[f.key]);

      if (!nextField) {
        const reply = `Anh đã cung cấp đủ thông tin rồi ạ. Anh xem lại form và nhấn Nộp khi sẵn sàng nhé.`;
        addTurn({ role: 'model', text: reply });
        return reply;
      }

      // 3. Skip keyword
      const skipKeywords = ['bỏ qua', 'bo qua', 'không biết', 'khong biet', 'để sau', 'de sau', 'skip'];
      if (skipKeywords.some((kw) => transcript.toLowerCase().includes(kw))) {
        retryRef.current[nextField.key] = 0;
        setFilledField({ fieldKey: nextField.key, value: '', confidence: 0 });
        const updatedFilled = useFormAiStore.getState().filledFields;
        const nextNext = fields.find((f) => !updatedFilled[f.key]);
        const ctx = nextNext
          ? `Người dùng bỏ qua "${nextField.label}". Chuyển sang hỏi: "${nextNext.label}".`
          : 'Người dùng bỏ qua field cuối. Tất cả đã xử lý xong.';
        const reply = await generateResponse(ctx, store.persona, history, false);
        addTurn({ role: 'model', text: reply });
        return reply;
      }

      // 4. Extract
      const filled = await extractFieldValue(transcript, nextField, history);
      const threshold =
        CONFIDENCE_THRESHOLD[nextField.type === 'enum' ? 'enum' : nextField.key] ??
        CONFIDENCE_THRESHOLD.diaChi;

      if (filled.value && filled.confidence >= threshold) {
        retryRef.current[nextField.key] = 0;
        setFilledField(filled);
        setters[nextField.key]?.(filled.value);
        onFallbackKeyboard(null);
        if (wasInterrupted) setWasInterrupted(false);

        const updatedFilled = useFormAiStore.getState().filledFields;
        const nextNext = fields.find((f) => !updatedFilled[f.key]);
        const context = nextNext
          ? `Đã fill "${nextField.label}" = "${filled.value}". Hỏi tiếp: "${nextNext.label}".`
          : `Đã fill "${nextField.label}" = "${filled.value}". Tất cả field đã điền xong.`;
        const reply = await generateResponse(context, store.persona, history, wasInterrupted);
        addTurn({ role: 'model', text: reply });
        return reply;
      }

      // 5. Retry / fallback keyboard
      const retries = (retryRef.current[nextField.key] ?? 0) + 1;
      retryRef.current[nextField.key] = retries;

      if (retries >= MAX_RETRIES) {
        const reply = `Em xin lỗi, em chưa nghe rõ. Anh có thể nhập trực tiếp phần "${nextField.label}" trên màn hình nhé.`;
        addTurn({ role: 'model', text: reply });
        onFallbackKeyboard(nextField.key);
        return reply;
      }

      const context = `Cần làm rõ field "${nextField.label}". Người dùng nói không rõ, nhắc lại format.`;
      const reply = await generateResponse(context, store.persona, history, wasInterrupted);
      addTurn({ role: 'model', text: reply });
      return reply;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fields, setters, navigate, addTurn, setFilledField, setWasInterrupted, wasInterrupted],
  );

  // ── Đăng ký / gỡ bỏ override theo active ─────────────────────────────────
  useEffect(() => {
    if (!active) {
      setTranscriptOverride(null);
      return;
    }

    // Reset store và persona khi bật
    const cccdData = useSessionUserStore.getState().cccdData;
    const ngaySinh = cccdData?.ngaySinh ?? '';
    useFormAiStore.getState().setPersona(resolvePersona(ngaySinh));
    resetStore();
    retryRef.current = {};

    setTranscriptOverride(handleTranscript);

    // Greeting khi kích hoạt
    const firstField = fields[0];
    if (firstField) {
      const hint = firstField.hint ? ` (${firstField.hint})` : '';
      const greeting = `Tôi sẽ hỗ trợ bạn điền form. Bắt đầu với ${firstField.label}${hint}. Bạn hãy nói thông tin này.`;
      speakText(greeting);
    }

    return () => setTranscriptOverride(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Scroll + focus khi fallback keyboard (gọi từ page qua onFallbackKeyboard)
  // → page tự xử lý via useEffect theo fallbackFieldKey
}
