interface FormFooterProps {
  onBack: () => void;
  onDraft?: () => void;
  onSubmit: () => void;
  submitEnabled?: boolean;
  submitLabel?: string;
  draftLabel?: string;
  backLabel?: string;
  /** Class prefix — 'ttbl' (luu-tru), 'tkbtv' (mặc định cho form thường trú + tạm vắng). */
  variant?: 'ttbl' | 'tkbtv';
  /** Slot cho AI hỗ trợ nhập liệu button */
  aiButton?: React.ReactNode;
}

export function FormFooter({
  onBack,
  onDraft,
  onSubmit,
  submitEnabled = true,
  submitLabel = 'Nộp hồ sơ',
  draftLabel = 'Lưu nháp',
  backLabel = 'Quay lại',
  variant = 'tkbtv',
  aiButton,
}: FormFooterProps) {
  const prefix = variant === 'ttbl' ? 'ttbl-ft-btn' : 'tkbtv-footer-btn';
  const rootClass = variant === 'ttbl' ? 'ttbl-footer' : 'tkbtv-footer';
  const rightClass = variant === 'ttbl' ? 'ttbl-footer-right' : 'tkbtv-footer-right';

  return (
    <div className={rootClass}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className={`${prefix} ${prefix}--back`} onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {backLabel}
        </button>
        {aiButton}
      </div>

      <div className={rightClass}>
        {onDraft && (
          <button className={`${prefix} ${prefix}--draft`} onClick={onDraft}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M9 2H4.5A1.5 1.5 0 003 3.5v9A1.5 1.5 0 004.5 14h7a1.5 1.5 0 001.5-1.5V6L9 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {draftLabel}
          </button>
        )}
        <button
          className={`${prefix} ${prefix}--submit${submitEnabled ? '' : ` ${prefix}--disabled`}`}
          disabled={!submitEnabled}
          onClick={onSubmit}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M14 2L7 13l-3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
