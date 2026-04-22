import '@styles/components/unsaved-changes-modal.css';
import { Modal } from './Modal';
import { useModalSound } from '@hooks/useModalSound';

interface UnsavedChangesModalProps {
  open: boolean;
  /** Tiếp tục chỉnh sửa — đóng modal, ở lại trang. */
  onClose: () => void;
  /** Lưu nháp — gọi API lưu draft (nếu có) rồi cho phép rời trang. */
  onSaveDraft: () => void;
  /** Rời trang bỏ qua — xác nhận thoát không lưu. */
  onDiscard: () => void;
  title?: string;
  description?: string;
}

/**
 * Modal cảnh báo khi rời form còn dữ liệu chưa lưu.
 * 3 action: Lưu nháp | Tiếp tục chỉnh sửa | Hủy bỏ.
 * Scope vào .kiosk-content-panel để không phủ AI sidebar.
 */
export function UnsavedChangesModal({
  open,
  onClose,
  onSaveDraft,
  onDiscard,
  title = 'Dữ liệu chưa được lưu',
  description = 'Hồ sơ của bạn chưa được nộp. Bạn muốn lưu thành bản nháp hay hủy bỏ?',
}: UnsavedChangesModalProps) {
  useModalSound(open);

  return (
    <Modal
      open={open}
      overlayClassName="ucm-overlay"
      visibleClassName="ucm-overlay--visible"
      closeDurationMs={220}
      onClose={onClose}
      portalSelector=".kiosk-content-panel"
    >
      <div className="ucm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ucm-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="11" fill="#f59e0b" />
            <path
              d="M12 7v6"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="12" cy="17" r="1.3" fill="#ffffff" />
          </svg>
        </div>

        <h3 className="ucm-title">{title}</h3>
        <p className="ucm-desc">{description}</p>

        <div className="ucm-actions">
          <button className="ucm-btn ucm-btn--primary" onClick={onSaveDraft}>
            Lưu nháp
          </button>
          <button className="ucm-btn ucm-btn--outline" onClick={onClose}>
            Tiếp tục chỉnh sửa
          </button>
          <button className="ucm-btn ucm-btn--danger" onClick={onDiscard}>
            Hủy bỏ, không lưu
          </button>
        </div>
      </div>
    </Modal>
  );
}
