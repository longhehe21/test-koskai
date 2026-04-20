import '@styles/pages/login.css';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';

export default function LoginPage() {
  const navigate = useNavigate();

  usePageHeader({
    title: 'Trang đăng nhập',
    showBack: false,
    showUserBadge: false,
    showDocs: false,
  });

  return (
    <div className="login-form-area">
      <h1 className="login-title">Đăng nhập hệ thống</h1>
      <p className="login-subtitle">Vui lòng chọn phương thức xác thực để tiếp tục.</p>

      <div className="login-options-card">
        <button className="login-cccd-option" onClick={() => navigate('/scan-guide')}>
          <div className="cccd-icon">
            <img src="/assets/icon-cccd.svg" alt="CCCD" className="cccd-icon-img" />
          </div>
          <div className="cccd-text">
            <span className="cccd-title">Quét CCCD gắn chip</span>
            <span className="cccd-desc">
              Sử dụng đầu đọc thẻ hoặc thiết bị di động hỗ trợ NFC để xác thực trực tiếp từ thẻ căn
              cước của bạn.
            </span>
          </div>
          <div className="cccd-arrow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </button>

        <div className="login-divider">
          <span className="login-divider-line" />
          <span className="login-divider-text">HOẶC</span>
          <span className="login-divider-line" />
        </div>

        <button className="login-vneid-btn" onClick={() => navigate('/vneid-login')}>
          <div className="vneid-content">
            <img src="/assets/vneid-logo.png" alt="VNeID" className="vneid-logo" />
            <span>Đăng nhập bằng VNeID</span>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>

        <p className="vneid-hint">
          Xác thực thông qua ứng dụng Định danh điện tử Quốc gia (VNeID) trên điện thoại của bạn.
        </p>
      </div>
    </div>
  );
}
