import { useFormAiStore } from '@store/formAiStore';

interface AiInputButtonProps {
  active: boolean;
  onToggle: () => void;
  totalFields: number;
  /** Class prefix để match với form ('tkbtv' hoặc 'ttbl') */
  variant?: 'tkbtv' | 'ttbl';
}

export function AiInputButton({ active, onToggle, totalFields, variant = 'tkbtv' }: AiInputButtonProps) {
  const filledFields = useFormAiStore((s) => s.filledFields);
  const filledCount = Object.values(filledFields).filter((f) => f.value !== '').length;
  const prefix = variant === 'ttbl' ? 'ttbl-ft-btn' : 'tkbtv-footer-btn';

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`ai-input-btn ${active ? 'ai-input-btn--active' : ''} ${prefix}`}
      title={active ? 'Tắt AI hỗ trợ nhập liệu' : 'Bật AI hỗ trợ nhập liệu'}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
      {active ? (
        <span>AI đang hỗ trợ ({filledCount}/{totalFields})</span>
      ) : (
        <span>AI hỗ trợ nhập liệu</span>
      )}
      {active && (
        <span className="ai-input-btn__pulse" aria-hidden="true" />
      )}
    </button>
  );
}
