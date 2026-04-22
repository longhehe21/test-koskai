import '@styles/pages/luu-tru-ho-so.css';
import { useState } from 'react';
import { Modal } from './Modal';

interface LuuTruHoSoModalProps {
  open: boolean;
  onDismiss: () => void;
  /** Gọi khi user submit — answer: 'yes' (đã có đơn) | 'no' (chưa có). */
  onSubmit: (answer: 'yes' | 'no') => void;
  /** URL ảnh mẫu đơn xin xác nhận lưu trú. */
  mauDonImage?: string;
}

export function LuuTruHoSoModal({
  open,
  onDismiss,
  onSubmit,
  mauDonImage = '/assets/mauct03khaibaotamvang.svg',
}: LuuTruHoSoModalProps) {
  const [answer, setAnswer] = useState<'yes' | 'no' | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleNext = () => {
    if (!answer) return;
    onSubmit(answer);
  };

  return (
    <>
      <Modal
        open={open && !showPreview}
        overlayClassName="ltrhsm-overlay"
        visibleClassName="ltrhsm-overlay--visible"
        onClose={onDismiss}
        portalSelector=".kiosk-content-panel"
      >
        <div className="ltrhsm-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ltrhs-area">
            <h1 className="ltrhs-title">HỒ SƠ ĐÍNH KÈM</h1>

            <div className="ltrhs-question">
              <div className="ltrhs-question-header">
                <p className="ltrhs-question-text">
                  Bạn có <strong>ĐƠN XIN XÁC NHẬN LƯU TRÚ</strong> chưa?
                </p>
                <a
                  href="#"
                  className="ltrhs-view-form"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowPreview(true);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6" stroke="#2563eb" strokeWidth="1.5" />
                    <path d="M7 4v4M7 9.5v.5" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Xem mẫu đơn
                </a>
              </div>
              <div className="ltrhs-options" data-question="don-luu-tru">
                <button
                  type="button"
                  className={`ltrhs-option ${answer === 'yes' ? 'ltrhs-option--active' : 'ltrhs-option--inactive'}`}
                  onClick={() => setAnswer('yes')}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
                    <path
                      d="M6 10l3 3 5-5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Đã có
                </button>
                <button
                  type="button"
                  className={`ltrhs-option ${answer === 'no' ? 'ltrhs-option--active' : 'ltrhs-option--inactive'}`}
                  onClick={() => setAnswer('no')}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" strokeWidth="1.5">
                    <rect x="2" y="1" width="12" height="15" rx="2" stroke="currentColor" />
                    <rect x="6" y="4" width="10" height="13" rx="2" stroke="currentColor" fill="none" />
                    <path d="M9 8h4M9 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  Chưa có
                </button>
              </div>
            </div>

            <div className="ltrhs-footer">
              <button type="button" className="ltrhs-btn ltrhs-btn--back" onClick={onDismiss}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M11 4L6 9l5 5"
                    stroke="#374151"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Quay lại
              </button>
              <button
                type="button"
                className={`ltrhs-btn ltrhs-btn--next ${answer ? '' : 'ltrhs-btn--disabled'}`}
                disabled={!answer}
                onClick={handleNext}
              >
                Tiếp tục
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M7 4l5 5-5 5"
                    stroke="white"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={open && showPreview}
        overlayClassName="maudon-overlay"
        visibleClassName="maudon-overlay--visible"
        onClose={() => setShowPreview(false)}
        portalSelector=".kiosk-content-panel"
      >
        <div className="maudon-container" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="maudon-close"
            onClick={() => setShowPreview(false)}
            aria-label="Đóng"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="#374151" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <img src={mauDonImage} alt="Mẫu đơn xin xác nhận lưu trú" className="maudon-image" />
        </div>
      </Modal>
    </>
  );
}
