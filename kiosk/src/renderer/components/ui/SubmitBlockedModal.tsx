import '@styles/components/confirm-submit-modal.css';
import { Modal } from './Modal';
import { useModalSound } from '@hooks/useModalSound';

interface SubmitBlockedModalProps {
  open: boolean;
  /** Danh sách tên giấy tờ user đã tick "Chưa có" — render vào description. */
  missingDocs: string[];
  /** Đóng modal không làm gì. */
  onClose: () => void;
  /** User chọn Lưu nháp → tiếp tục sau. */
  onSaveDraft: () => void;
  /** Optional: quay lại trang scan của thủ tục đó để bổ sung giấy tờ. Nếu
   * không truyền → không render button "Quay lại bổ sung". */
  onGoBack?: () => void;
  title?: string;
}

/**
 * Modal chặn nộp hồ sơ khi thiếu giấy tờ bắt buộc (user tick "Chưa có" ở
 * HoSoDinhKemModal cho các giấy tờ NGOÀI mẫu đơn CT01/CT02).
 *
 * Icon cảnh báo (vàng) thay vì tick xanh — phân biệt với ConfirmSubmitModal.
 * Action: "Lưu nháp" (primary) hoặc "Đóng" (bổ sung thêm tài liệu).
 */
export function SubmitBlockedModal({
  open,
  missingDocs,
  onClose,
  onSaveDraft,
  onGoBack,
  title = 'Chưa thể nộp hồ sơ',
}: SubmitBlockedModalProps) {
  useModalSound(open);

  const description =
    missingDocs.length === 0
      ? 'Hồ sơ chưa đủ điều kiện nộp. Vui lòng bổ sung hoặc lưu nháp để tiếp tục sau.'
      : `Thiếu ${missingDocs.map((d) => `"${d}"`).join(', ')} bắt buộc. `
        + 'Vui lòng bổ sung giấy tờ, hoặc bấm "Lưu nháp" để tiếp tục sau.';

  return (
    <Modal
      open={open}
      overlayClassName="csm-overlay"
      visibleClassName="csm-overlay--visible"
      closeDurationMs={220}
      onClose={onClose}
      portalSelector=".kiosk-content-panel"
    >
      <div className="csm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Icon cảnh báo vàng — phân biệt với tick xanh success */}
        <div className="csm-icon" style={{ background: 'transparent' }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L1 21h22L12 2z"
              fill="#f59e0b"
              stroke="#f59e0b"
              strokeWidth="1"
              strokeLinejoin="round"
            />
            <path
              d="M12 9v5"
              stroke="#ffffff"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <circle cx="12" cy="17.5" r="1.2" fill="#ffffff" />
          </svg>
        </div>

        <h3 className="csm-title">{title}</h3>
        <p className="csm-desc">{description}</p>

        <div className="csm-actions">
          <button className="csm-btn csm-btn--primary" onClick={onSaveDraft}>
            Lưu nháp
          </button>
          {onGoBack && (
            <button className="csm-btn csm-btn--outline" onClick={onGoBack}>
              Quay lại bổ sung
            </button>
          )}
          <button className="csm-btn csm-btn--outline" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
}
