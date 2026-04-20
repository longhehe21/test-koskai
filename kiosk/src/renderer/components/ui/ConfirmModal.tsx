import '@styles/pages/ho-khau-ho-so-dinh-kem.css';
import { Fragment } from 'react';
import { Modal } from './Modal';

interface ConfirmModalProps {
  open: boolean;
  /** Văn bản highlight (blue). Mỗi dòng 1 string, render trên dòng riêng. */
  highlightLines: string[];
  onContinue: () => void;
  /** Gọi khi user nhấn Quay lại / click X / click outside. */
  onBack?: () => void;
  backLabel?: string;
  continueLabel?: string;
  title?: string;
}

export function ConfirmModal({
  open,
  highlightLines,
  onContinue,
  onBack,
  backLabel = 'Quay lại bổ sung',
  continueLabel = 'Tiếp tục',
  title = 'Thông báo',
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      overlayClassName="hkhsdk-confirm-overlay"
      visibleClassName="hkhsdk-confirm-overlay--visible"
      onClose={onBack}
    >
      <div className="confirm-novb-modal" onClick={(e) => e.stopPropagation()}>
        <button className="confirm-novb-close" onClick={onBack} aria-label="Đóng">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 4l8 8M12 4L4 12"
              stroke="#EF4444"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="confirm-novb-icon">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" stroke="#2563eb" strokeWidth="2" />
            <path d="M16 10v8" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="16" cy="22" r="1.5" fill="#2563eb" />
          </svg>
        </div>

        <h2 className="confirm-novb-title">{title}</h2>
        <p className="confirm-novb-text">
          Xác nhận <strong>KHÔNG CÓ</strong>
          <br />
          <span className="confirm-novb-highlight">
            {highlightLines.map((line, i) => (
              <Fragment key={i}>
                {line}
                {i < highlightLines.length - 1 && <br />}
              </Fragment>
            ))}
          </span>
          <br />
          Bạn có muốn tiếp tục?
        </p>

        <div className="confirm-novb-footer">
          <button className="confirm-novb-btn confirm-novb-btn--back" onClick={onBack}>
            {backLabel}
          </button>
          <button className="confirm-novb-btn confirm-novb-btn--next" onClick={onContinue}>
            {continueLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
