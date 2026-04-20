import '@styles/pages/cccd-verify.css';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import { useCurrentUser } from '@hooks/useCurrentUser';

interface InfoRow {
  label: string;
  value: string;
  iconPath: JSX.Element;
}

export default function CccdVerifyPage() {
  const navigate = useNavigate();
  const user = useCurrentUser();

  usePageHeader({
    title: 'Xác thực CCCD',
    showUserBadge: false,
    showDocs: false,
  });

  const rows: InfoRow[] = [
    {
      label: 'HỌ TÊN',
      value: user.hoTen,
      iconPath: (
        <>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </>
      ),
    },
    {
      label: 'SỐ ĐDCN',
      value: '00XXX912243',
      iconPath: (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="7" y1="8" x2="17" y2="8" />
          <line x1="7" y1="12" x2="13" y2="12" />
        </>
      ),
    },
    {
      label: 'NGÀY SINH',
      value: user.ngaySinh,
      iconPath: (
        <>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </>
      ),
    },
    {
      label: 'GIỚI TÍNH',
      value: user.gioiTinh,
      iconPath: (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="10" cy="7" r="4" />
          <line x1="18" y1="8" x2="18" y2="14" />
          <line x1="15" y1="11" x2="21" y2="11" />
        </>
      ),
    },
    {
      label: 'TỈNH/THÀNH PHỐ',
      value: user.thuongTru.province,
      iconPath: (
        <>
          <path d="M3 21h18" />
          <path d="M5 21V7l8-4v18" />
          <path d="M19 21V11l-6-4" />
        </>
      ),
    },
    {
      label: 'XÃ/PHƯỜNG',
      value: user.thuongTru.ward,
      iconPath: (
        <>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </>
      ),
    },
    {
      label: 'ĐỊA CHỈ CHI TIẾT',
      value: user.thuongTru.diaChi,
      iconPath: (
        <>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </>
      ),
    },
  ];

  return (
    <div className="cccd-verify-area">
      <div className="cccd-header-section">
        <div className="cccd-verify-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="12" fill="#2563eb" />
            <path
              d="M7 13l3 3 7-7"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="cccd-verify-title">Thông tin xác thực thẻ CCCD</h1>
        <p className="cccd-verify-subtitle">
          Thông tin của bạn đã được trích xuất thành công từ chip.
        </p>
      </div>

      <div className="cccd-main-card">
        <h2 className="face-section-title">XÁC THỰC KHUÔN MẶT</h2>

        <div className="cccd-card-body">
          <div className="cccd-info-side">
            <div className="cccd-info-layout">
              <div className="cccd-photo">
                <img src={user.photoSrc} alt={user.hoTen} className="cccd-photo-img" />
              </div>
              <div className="cccd-info-grid">
                {rows.map((row) => (
                  <div key={row.label} className="cccd-info-row">
                    <span className="cccd-info-label">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        {row.iconPath}
                      </svg>
                      {row.label}
                    </span>
                    <span className="cccd-info-value">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="cccd-ekyc-side">
            <div className="ekyc-frame">
              <div className="ekyc-video-layer">
                <svg width="70" height="70" viewBox="0 0 100 100" fill="none">
                  <circle cx="50" cy="38" r="16" fill="#c1cbd6" />
                  <path d="M20 82c0-16 13-28 30-28s30 12 30 28" fill="#c1cbd6" />
                </svg>
              </div>
              <div className="ekyc-overlay-mask" />
              <div className="ekyc-guide-ui">
                <div className="ekyc-corner ekyc-corner-tl" />
                <div className="ekyc-corner ekyc-corner-tr" />
                <div className="ekyc-corner ekyc-corner-bl" />
                <div className="ekyc-corner ekyc-corner-br" />
              </div>
              <svg className="ekyc-dashed-circle" viewBox="0 0 200 200">
                <circle
                  cx="100"
                  cy="100"
                  r="88"
                  fill="none"
                  stroke="rgba(148,163,184,0.5)"
                  strokeWidth="1.5"
                  strokeDasharray="6 4"
                />
              </svg>
            </div>
            <p className="ekyc-hint">Vui lòng di chuyển khuôn mặt vào khung để xác thực</p>
          </div>
        </div>
      </div>

      <div className="cccd-footer-bar">
        <div className="cccd-footer-actions">
          <button className="cccd-btn-back" onClick={() => navigate(-1)}>
            Quét lại
          </button>
          <button className="cccd-btn-confirm" onClick={() => navigate('/services')}>
            Xác nhận &amp; Tiếp tục
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>

      <p className="cccd-hotline">
        Tổng đài hỗ trợ: <strong>18001096</strong>
      </p>
    </div>
  );
}
