import '@styles/pages/vneid-login.css';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';

export default function VneidLoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [cccd, setCccd] = useState('');
  const [password, setPassword] = useState('');

  usePageHeader({
    title: 'Đăng nhập VNeID',
    showUserBadge: false,
    showDocs: false,
  });

  return (
    <div className="vneid-login-area">
      <h1 className="vneid-login-title">Đăng nhập bằng VNeID</h1>

      <div className="vneid-login-card">
        <div className="vneid-form">
          <div className="vneid-field">
            <label className="vneid-label">Số định danh cá nhân</label>
            <div className="vneid-input-wrapper">
              <span className="vneid-input-icon">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#595c5e"
                  strokeWidth="1.8"
                >
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <circle cx="9" cy="11" r="2.5" />
                  <path d="M5 18c0-2 1.5-3.5 4-3.5s4 1.5 4 3.5" />
                  <line x1="15" y1="9" x2="19" y2="9" />
                  <line x1="15" y1="13" x2="19" y2="13" />
                </svg>
              </span>
              <input
                type="text"
                className="vneid-input"
                placeholder="Nhập 12 số CCCD"
                maxLength={12}
                inputMode="numeric"
                value={cccd}
                onChange={(e) => setCccd(e.target.value)}
              />
            </div>
          </div>

          <div className="vneid-field">
            <label className="vneid-label">Mật khẩu</label>
            <div className="vneid-input-wrapper">
              <span className="vneid-input-icon">
                <svg
                  width="16"
                  height="20"
                  viewBox="0 0 16 20"
                  fill="none"
                  stroke="#595c5e"
                  strokeWidth="1.8"
                >
                  <rect x="1" y="9" width="14" height="10" rx="2" />
                  <path d="M4 9V6a4 4 0 0 1 8 0v3" />
                  <circle cx="8" cy="14" r="1.5" fill="#595c5e" stroke="none" />
                </svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                className="vneid-input vneid-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="vneid-toggle-password"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {!showPassword ? (
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="1.8"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="1.8"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="vneid-forgot-row">
            <a href="#" className="vneid-forgot-link" onClick={(e) => e.preventDefault()}>
              Quên mật khẩu?
            </a>
          </div>

          <button className="vneid-submit-btn" onClick={() => navigate('/services')}>
            Đăng nhập
          </button>
        </div>

        <div className="vneid-divider" />

        <div className="vneid-qr-section">
          <p className="vneid-qr-label">Hoặc quét mã QR trên thiết bị di động</p>

          <div className="vneid-qr-frame">
            <div className="vneid-qr-corner vneid-qr-tl" />
            <div className="vneid-qr-corner vneid-qr-tr" />
            <div className="vneid-qr-corner vneid-qr-bl" />
            <div className="vneid-qr-corner vneid-qr-br" />
            <div className="vneid-qr-placeholder">
              <svg
                width="45"
                height="45"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#0052d0"
                strokeWidth="1.2"
                opacity="0.4"
              >
                <rect x="2" y="2" width="8" height="8" rx="1" />
                <rect x="14" y="2" width="8" height="8" rx="1" />
                <rect x="2" y="14" width="8" height="8" rx="1" />
                <rect x="14" y="14" width="4" height="4" rx="0.5" />
                <rect x="18" y="18" width="4" height="4" rx="0.5" />
                <rect x="14" y="18" width="4" height="4" rx="0.5" opacity="0.5" />
              </svg>
            </div>
          </div>

          <p className="vneid-qr-hint">
            Mở ứng dụng VNeID trên điện thoại của bạn, chọn biểu tượng QR để đăng nhập nhanh
            chóng.
          </p>
        </div>
      </div>
    </div>
  );
}
