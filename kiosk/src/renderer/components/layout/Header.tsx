import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLayoutStore } from '@store/layoutStore';
import {
  isSoundMuted,
  sound,
  subscribeSoundMuted,
  toggleSoundMuted,
} from '@services/soundService';
import {
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  decreaseFontScale,
  getFontScale,
  increaseFontScale,
  subscribeFontScale,
} from '@services/fontScaleService';
import { purgeSession } from '@utils/purgeSession';

export function Header() {
  const navigate = useNavigate();
  const header = useLayoutStore((s) => s.header);
  // Đồng bộ mute state từ service (singleton) → re-render khi user toggle.
  const [muted, setMuted] = useState(() => isSoundMuted());
  useEffect(() => subscribeSoundMuted(setMuted), []);

  // Font scale state — subscribe service, disable nút ở 2 đầu min/max.
  const [fontScale, setFontScale] = useState(() => getFontScale());
  useEffect(() => subscribeFontScale(setFontScale), []);

  // User menu dropdown: click badge → xổ menu Đăng xuất. Click ngoài → đóng.
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!userMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [userMenuOpen]);

  const handleToggleMute = () => {
    toggleSoundMuted();
    // Phát tick sau khi unmute để user nghe ngay xác nhận âm thanh hoạt động.
    if (muted) sound.tick();
  };

  const handleLogout = () => {
    setUserMenuOpen(false);
    purgeSession();
    navigate('/', { replace: true });
  };

  return (
    <header className="kiosk-header">
      <div className="header-left">
        <span className="header-logo">KioskAI</span>
        <span className="header-divider" />
        <span className="header-page-title">{header.title}</span>
      </div>

      <div className="header-right">
        {/* Hotline fix cứng — hiển thị trên mọi trang để user luôn biết số gọi khi cần */}
        <div className="kiosk-hotline-pill">
          <svg
            className="kiosk-hotline-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <span className="kiosk-hotline-label">Tổng đài</span>
          <span className="kiosk-hotline-divider" aria-hidden="true" />
          <span className="kiosk-hotline-number">1800 1096</span>
        </div>

        {header.showUserBadge && (
          <div className="header-user-wrap" ref={userMenuRef}>
            <button
              type="button"
              className={`header-user-badge${userMenuOpen ? ' header-user-badge--open' : ''}`}
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>{header.userName ?? 'Người dùng'}</span>
              <svg
                className="header-user-caret"
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="4 6 8 10 12 6" />
              </svg>
            </button>
            {userMenuOpen && (
              <div className="header-user-menu" role="menu">
                <button
                  type="button"
                  className="header-user-menu-item"
                  onClick={handleLogout}
                  role="menuitem"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        )}

        {header.showDocs && (
          <button className="header-docs-btn" onClick={() => navigate('/ho-so-cua-toi')}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Hồ sơ của tôi
          </button>
        )}

        <div className="font-scale-group" role="group" aria-label="Cỡ chữ">
          <button
            className="font-scale-btn font-scale-btn--smaller"
            onClick={decreaseFontScale}
            disabled={fontScale <= FONT_SCALE_MIN}
            aria-label="Giảm cỡ chữ"
            title="Giảm cỡ chữ"
          >
            <span className="font-scale-letter font-scale-letter--sm">A</span>
            <span className="font-scale-sign">−</span>
          </button>
          <button
            className="font-scale-btn font-scale-btn--larger"
            onClick={increaseFontScale}
            disabled={fontScale >= FONT_SCALE_MAX}
            aria-label="Tăng cỡ chữ"
            title="Tăng cỡ chữ"
          >
            <span className="font-scale-letter font-scale-letter--lg">A</span>
            <span className="font-scale-sign">+</span>
          </button>
        </div>

        <button
          className="mute-btn"
          onClick={handleToggleMute}
          aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
        >
          {muted ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          )}
        </button>

        <button className="lang-btn" aria-label="Ngôn ngữ">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          Tiếng Việt
        </button>

      </div>
    </header>
  );
}
