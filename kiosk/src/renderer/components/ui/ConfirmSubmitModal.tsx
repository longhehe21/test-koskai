import '@styles/components/confirm-submit-modal.css';
import { Modal } from './Modal';
import { useModalSound } from '@hooks/useModalSound';

interface ConfirmSubmitModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

/**
 * Modal xác nhận trước khi nộp hồ sơ — action không undo được.
 * Scope vào .kiosk-content-panel, AI sidebar vẫn tương tác được.
 */
export function ConfirmSubmitModal({
  open,
  onCancel,
  onConfirm,
  title = 'Xác nhận nộp hồ sơ',
  description = 'Sau khi nộp, hồ sơ sẽ được chuyển đến bộ phận chuyên môn và không thể chỉnh sửa. Bạn có chắc chắn muốn tiếp tục?',
  confirmLabel = 'Xác nhận nộp',
  cancelLabel = 'Kiểm tra lại',
}: ConfirmSubmitModalProps) {
  useModalSound(open);

  return (
    <Modal
      open={open}
      overlayClassName="csm-overlay"
      visibleClassName="csm-overlay--visible"
      closeDurationMs={220}
      onClose={onCancel}
      portalSelector=".kiosk-content-panel"
    >
      <div className="csm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="csm-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="11" fill="#2563eb" />
            <path
              d="M9 12l2 2 4-4"
              stroke="#ffffff"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h3 className="csm-title">{title}</h3>
        <p className="csm-desc">{description}</p>

        <div className="csm-actions">
          <button className="csm-btn csm-btn--primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button className="csm-btn csm-btn--outline" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
