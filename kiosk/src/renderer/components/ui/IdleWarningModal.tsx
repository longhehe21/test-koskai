import '@styles/components/idle-warning-modal.css';
import { Modal } from './Modal';
import { useModalSound } from '@hooks/useModalSound';

interface IdleWarningModalProps {
  open: boolean;
  remainingMs: number;
  totalMs: number;
  onStay: () => void;
  onExit: () => void;
}

/**
 * Modal cảnh báo auto-logout kiosk. Hiện đếm ngược + progress bar.
 * Bắt buộc user bấm xác nhận để tiếp tục — tránh accidental touch.
 */
export function IdleWarningModal({
  open,
  remainingMs,
  totalMs,
  onStay,
  onExit,
}: IdleWarningModalProps) {
  useModalSound(open);

  const remainingSec = Math.max(1, Math.ceil(remainingMs / 1000));
  const progressPct = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));

  return (
    <Modal
      open={open}
      overlayClassName="iwm-overlay"
      visibleClassName="iwm-overlay--visible"
      closeOnBackdrop={false}
      onClose={onStay}
      portalSelector=".kiosk-content-panel"
    >
      <div className="iwm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="iwm-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="11" fill="#f59e0b" />
            <path
              d="M12 7v5l3 2"
              stroke="#ffffff"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h3 className="iwm-title">Bạn có còn ở đây?</h3>
        <p className="iwm-desc">
          Phiên làm việc sẽ tự động kết thúc sau{' '}
          <strong className="iwm-countdown">{remainingSec}s</strong> để bảo vệ thông tin cá nhân của
          bạn.
        </p>

        <div className="iwm-progress">
          <div className="iwm-progress-bar" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="iwm-actions">
          <button className="iwm-btn iwm-btn--primary" onClick={onStay}>
            Tôi vẫn ở đây
          </button>
          <button className="iwm-btn iwm-btn--outline" onClick={onExit}>
            Kết thúc phiên
          </button>
        </div>
      </div>
    </Modal>
  );
}
