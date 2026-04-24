import { useCallback, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Header } from './Header';
import { AiSidebar } from './AiSidebar';
import { FlowStepper } from './FlowStepper';
import { IdleWarningModal } from '@components/ui';
import { useIdleTimer } from '@hooks/useIdleTimer';
import { useGlobalClickSound } from '@hooks/useGlobalClickSound';
import { purgeSession } from '@utils/purgeSession';
import { hideVirtualKeyboard } from '@utils/keyboardControl';
import { useScanStore } from '@store/scanStore';

/**
 * Routes thuộc flow "sau khi scan" — user đang tiếp tục forward.
 * Ở các route này KHÔNG clear scan store (giữ ảnh cho các bước tiếp theo).
 * Rời khỏi tập này (về services, truong-hop, doi-tuong...) → clear.
 */
const POST_SCAN_PATTERN = /^\/(scan-|xem-truoc-|tao-ho-so-|nop-ho-so-thanh-cong)/;

// 90s không hoạt động → cảnh báo 30s → tự kết thúc phiên.
// Đủ thời gian user đọc form dài / nhập chậm, vẫn đảm bảo bảo mật PII.
const IDLE_MS = 90_000;
const WARNING_MS = 30_000;

// Routes không dùng auto-logout toàn cục:
//  - '/', '/scan-guide': user chưa có PII, không cần bảo vệ
//  - '/nop-ho-so-thanh-cong': có countdown riêng về /services (không logout)
const IDLE_EXEMPT_ROUTES = new Set(['/', '/scan-guide', '/nop-ho-so-thanh-cong']);

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  // Global tick sound cho mọi click button — kiosk touch cần tactile feedback.
  useGlobalClickSound();

  const isIdleEnabled = !IDLE_EXEMPT_ROUTES.has(location.pathname);

  const handleTimeout = useCallback(() => {
    purgeSession();
    navigate('/', { replace: true });
  }, [navigate]);

  const { isWarning, warningRemainingMs, dismissWarning } = useIdleTimer({
    idleMs: IDLE_MS,
    warningMs: WARNING_MS,
    enabled: isIdleEnabled,
    onTimeout: handleTimeout,
  });

  // Khi route đổi → ẩn mọi floating UI toàn cục (keyboard + idle warning).
  // Page-level modal (ConfirmSubmit, UnsavedChanges, DraftSaved) unmount tự
  // động theo page nên không cần xử lý. Skip first mount để tránh no-op spam.
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    hideVirtualKeyboard();
    dismissWarning();
  }, [location.pathname, dismissWarning]);

  // Clear scan store khi user rời khỏi flow (quay lại services, trường hợp, nguồn gốc...).
  // Giữ ảnh khi user còn trong /scan-*, /xem-truoc-*, /tao-ho-so-*, /nop-ho-so-thanh-cong.
  useEffect(() => {
    if (!POST_SCAN_PATTERN.test(location.pathname)) {
      useScanStore.getState().clearAll();
    }
  }, [location.pathname]);

  return (
    <div className="app-layout">
      <Header />
      <div className="kiosk-body">
        <AiSidebar />
        <main className="kiosk-content-panel">
          <FlowStepper />
          <div key={location.pathname} className="route-view panel-slide-in">
            <Outlet />
          </div>
        </main>
      </div>

      <IdleWarningModal
        open={isWarning}
        remainingMs={warningRemainingMs}
        totalMs={WARNING_MS}
        onStay={dismissWarning}
        onExit={handleTimeout}
      />
    </div>
  );
}
