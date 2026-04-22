import '@styles/components/print-preview-modal.css';
import { useState } from 'react';
import { Modal } from './Modal';
import { printReceipt, type ReceiptData } from '@services/printService';
import { sound } from '@services/soundService';
import { useModalSound } from '@hooks/useModalSound';

interface PrintPreviewModalProps {
  open: boolean;
  onClose: () => void;
  data: ReceiptData;
}

type PrintState = 'idle' | 'printing' | 'success' | 'error';

/**
 * Preview phiếu biên nhận (80mm thermal) + nút In / In lại / Đóng.
 * Simulate layout giấy in thật để user thấy nội dung trước khi in.
 */
export function PrintPreviewModal({ open, onClose, data }: PrintPreviewModalProps) {
  const [state, setState] = useState<PrintState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  useModalSound(open);

  const handlePrint = async () => {
    setState('printing');
    setErrorMsg(null);
    const result = await printReceipt(data);
    if (result.success) {
      sound.success();
      setState('success');
    } else {
      sound.error();
      setErrorMsg(result.error ?? 'Không thể in, vui lòng thử lại');
      setState('error');
    }
  };

  const handleClose = () => {
    setState('idle');
    setErrorMsg(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      overlayClassName="ppm-overlay"
      visibleClassName="ppm-overlay--visible"
      onClose={handleClose}
      portalSelector=".kiosk-content-panel"
    >
      <div className="ppm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ppm-header">
          <h3 className="ppm-title">Phiếu biên nhận</h3>
          <button className="ppm-close" onClick={handleClose} aria-label="Đóng">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4L4 12" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Preview giả lập giấy in 80mm — font mono để giống thermal printer */}
        <div className="ppm-receipt">
          <div className="ppm-receipt-header">
            <div className="ppm-receipt-brand">KioskAI</div>
            <div className="ppm-receipt-sub">Dịch vụ công tự phục vụ</div>
          </div>

          <div className="ppm-receipt-divider" />

          <div className="ppm-receipt-row">
            <span className="ppm-receipt-label">Thủ tục</span>
            <span className="ppm-receipt-value">{data.procedureName}</span>
          </div>

          <div className="ppm-receipt-row">
            <span className="ppm-receipt-label">Mã hồ sơ</span>
            <span className="ppm-receipt-code">{data.applicationCode}</span>
          </div>

          <div className="ppm-receipt-row">
            <span className="ppm-receipt-label">Ngày nộp</span>
            <span className="ppm-receipt-value">{data.submittedAt}</span>
          </div>

          {data.expectedResultDate && (
            <div className="ppm-receipt-row">
              <span className="ppm-receipt-label">Ngày hẹn trả</span>
              <span className="ppm-receipt-value">{data.expectedResultDate}</span>
            </div>
          )}

          {data.processingDays !== undefined && (
            <div className="ppm-receipt-row">
              <span className="ppm-receipt-label">Thời gian xử lý</span>
              <span className="ppm-receipt-value">{data.processingDays} ngày</span>
            </div>
          )}

          <div className="ppm-receipt-divider" />

          <div className="ppm-receipt-qr">
            {/* QR placeholder — khi có trackingUrl thì gen QR thật */}
            <svg width="96" height="96" viewBox="0 0 96 96">
              <rect width="96" height="96" fill="#ffffff" />
              <rect x="8" y="8" width="24" height="24" fill="#111827" />
              <rect x="12" y="12" width="16" height="16" fill="#ffffff" />
              <rect x="16" y="16" width="8" height="8" fill="#111827" />
              <rect x="64" y="8" width="24" height="24" fill="#111827" />
              <rect x="68" y="12" width="16" height="16" fill="#ffffff" />
              <rect x="72" y="16" width="8" height="8" fill="#111827" />
              <rect x="8" y="64" width="24" height="24" fill="#111827" />
              <rect x="12" y="68" width="16" height="16" fill="#ffffff" />
              <rect x="16" y="72" width="8" height="8" fill="#111827" />
              <rect x="40" y="40" width="4" height="4" fill="#111827" />
              <rect x="48" y="40" width="4" height="4" fill="#111827" />
              <rect x="40" y="48" width="4" height="4" fill="#111827" />
              <rect x="52" y="52" width="4" height="4" fill="#111827" />
              <rect x="44" y="60" width="4" height="4" fill="#111827" />
              <rect x="60" y="44" width="4" height="4" fill="#111827" />
            </svg>
            <p className="ppm-receipt-qr-hint">Quét mã để tra cứu hồ sơ</p>
          </div>

          <div className="ppm-receipt-footer">
            Giữ phiếu này để theo dõi tiến độ xử lý.
            <br />
            Cảm ơn quý công dân đã sử dụng dịch vụ.
          </div>
        </div>

        {errorMsg && <p className="ppm-error">{errorMsg}</p>}

        <div className="ppm-actions">
          {state === 'success' ? (
            <>
              <span className="ppm-success-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="11" fill="#22c55e" />
                  <path
                    d="M7 12l3.5 3.5L17 9"
                    stroke="#ffffff"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Đã gửi lệnh in
              </span>
              <button className="ppm-btn ppm-btn--outline" onClick={handlePrint}>
                In lại
              </button>
              <button className="ppm-btn ppm-btn--primary" onClick={handleClose}>
                Đóng
              </button>
            </>
          ) : (
            <>
              <button
                className="ppm-btn ppm-btn--primary"
                onClick={handlePrint}
                disabled={state === 'printing'}
              >
                {state === 'printing' ? 'Đang in...' : 'In phiếu'}
              </button>
              <button className="ppm-btn ppm-btn--outline" onClick={handleClose}>
                Đóng
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
