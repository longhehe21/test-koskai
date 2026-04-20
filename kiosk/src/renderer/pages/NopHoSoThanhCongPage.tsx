import '@styles/pages/nop-ho-so-thanh-cong.css';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';

// Placeholder QR rects — port nguyên từ UI repo (mô phỏng mã QR hiển thị).
const QR_RECTS: Array<[number, number, number?]> = [
  [56, 12, 8], [68, 12, 8], [56, 24, 8],
  [12, 56, 8], [24, 56, 8], [12, 68, 8],
  [56, 56, 8], [68, 56, 8], [80, 56, 8],
  [56, 68, 8], [56, 80, 8], [68, 68, 8], [80, 68, 8], [80, 80, 8],
  [92, 56, 8], [104, 56, 8], [92, 68, 8], [116, 68, 8],
  [92, 92, 8], [104, 92, 8], [116, 92, 8],
  [92, 104, 8], [116, 104, 8], [92, 116, 8], [104, 116, 8],
  [56, 92, 8], [68, 104, 8], [56, 116, 8], [68, 116, 8],
];

export default function NopHoSoThanhCongPage() {
  const navigate = useNavigate();

  usePageHeader({ title: 'Xác nhận nộp hồ sơ', showBack: false });

  return (
    <div className="nhstc-area">
      <div className="nhstc-body">
        <div className="nhstc-left">
          <div className="nhstc-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path
                d="M20 6L9 17l-5-5"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h1 className="nhstc-title">Nộp hồ sơ thành công!</h1>
          <p className="nhstc-desc">
            Cảm ơn bạn đã thực hiện thủ tục. Hồ sơ của bạn đã được tiếp nhận và đang được xử lý bởi
            bộ phận chuyên môn.
          </p>

          <div className="nhstc-card">
            <div className="nhstc-card-row">
              <div className="nhstc-card-col">
                <span className="nhstc-card-label">MÃ HỒ SƠ</span>
                <div className="nhstc-card-value">
                  24.03.15.000124
                  <button
                    className="nhstc-copy-btn"
                    onClick={() => navigator.clipboard?.writeText('24.03.15.000124')}
                    aria-label="Sao chép mã hồ sơ"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="nhstc-card-divider" />
              <div className="nhstc-card-col nhstc-card-col--right">
                <span className="nhstc-card-label">THỜI GIAN TIẾP NHẬN</span>
                <span className="nhstc-card-time">15/03/2024 · 14:20</span>
              </div>
            </div>
          </div>

          <button className="nhstc-home-btn" onClick={() => navigate('/services')}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Về trang chủ
          </button>
        </div>

        <div className="nhstc-right">
          <div className="nhstc-qr-box">
            <svg className="nhstc-qr-placeholder" width="260" height="260" viewBox="0 0 140 140">
              <rect width="140" height="140" fill="#ffffff" rx="8" />
              <rect x="12" y="12" width="36" height="36" rx="4" fill="#1e293b" />
              <rect x="16" y="16" width="28" height="28" rx="2" fill="#ffffff" />
              <rect x="22" y="22" width="16" height="16" rx="1" fill="#1e293b" />
              <rect x="92" y="12" width="36" height="36" rx="4" fill="#1e293b" />
              <rect x="96" y="16" width="28" height="28" rx="2" fill="#ffffff" />
              <rect x="102" y="22" width="16" height="16" rx="1" fill="#1e293b" />
              <rect x="12" y="92" width="36" height="36" rx="4" fill="#1e293b" />
              <rect x="16" y="96" width="28" height="28" rx="2" fill="#ffffff" />
              <rect x="22" y="102" width="16" height="16" rx="1" fill="#1e293b" />
              {QR_RECTS.map(([x, y, size = 8], i) => (
                <rect key={i} x={x} y={y} width={size} height={size} rx="1" fill="#1e293b" />
              ))}
            </svg>
          </div>
          <p className="nhstc-qr-text">Quét mã QR để theo dõi trạng thái hồ sơ trên điện thoại</p>
          <p className="nhstc-qr-hint">Sử dụng Camera hoặc ứng dụng Zalo để quét nhanh mã phía trên.</p>
        </div>
      </div>
    </div>
  );
}
