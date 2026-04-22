import '@styles/pages/draft-saved-modal.css';
import { Modal } from './Modal';
import { useModalSound } from '@hooks/useModalSound';

interface DraftSavedToastProps {
  open: boolean;
  onClose?: () => void;
  onContinue?: () => void;
  onList?: () => void;
  listLabel?: string;
}

export function DraftSavedToast({
  open,
  onClose,
  onContinue,
  onList,
  listLabel = 'Xem danh sách bản nháp',
}: DraftSavedToastProps) {
  useModalSound(open);
  const handleContinue = () => {
    onContinue?.();
    onClose?.();
  };
  const handleList = () => {
    onList?.();
    onClose?.();
  };

  return (
    <Modal
      open={open}
      overlayClassName="dsm-overlay"
      visibleClassName="dsm-overlay--visible"
      closeDurationMs={220}
      onClose={onClose}
      portalSelector=".kiosk-content-panel"
    >
      <div className="dsm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dsm-icon">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <circle cx="13" cy="13" r="12" fill="#10b981" />
            <path
              d="M8 13l3.5 3.5L18 10"
              stroke="#ffffff"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 className="dsm-title">Hồ sơ đã được lưu nháp thành công!</h3>
        <p className="dsm-desc">
          Bạn có thể tiếp tục hoàn thiện hồ sơ bất cứ lúc nào trong mục <strong>'Bản nháp'</strong>.
        </p>
        <div className="dsm-actions">
          <button className="dsm-btn dsm-btn--primary" onClick={handleContinue}>
            Tiếp tục chỉnh sửa
          </button>
          <button className="dsm-btn dsm-btn--outline" onClick={handleList}>
            {listLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
