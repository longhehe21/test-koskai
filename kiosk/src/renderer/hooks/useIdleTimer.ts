import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Idle timer cho kiosk — reset khi user có activity (pointer/key).
 * Dùng cho auto-logout purge PII sau khoảng idle.
 *
 * 2 giai đoạn:
 *  1. idle sau `idleMs` → `isWarning = true` (UI hiện modal cảnh báo)
 *  2. idle tiếp `warningMs` (không phản hồi modal) → gọi `onTimeout` (purge + navigate)
 *
 * Activity: pointerdown, touchstart, keydown (không dùng mousemove vì kiosk
 * có thể bị trigger bởi người đi qua, làm timer không bao giờ đạt idle).
 *
 * `enabled=false` để tắt hẳn (vd route login/scan-guide không cần auto-logout).
 */
export interface UseIdleTimerOptions {
  idleMs: number;
  warningMs: number;
  enabled?: boolean;
  onTimeout: () => void;
}

export function useIdleTimer({
  idleMs,
  warningMs,
  enabled = true,
  onTimeout,
}: UseIdleTimerOptions) {
  const [isWarning, setIsWarning] = useState(false);
  const [warningRemainingMs, setWarningRemainingMs] = useState(warningMs);

  const idleTimerRef = useRef<number | null>(null);
  const warningIntervalRef = useRef<number | null>(null);
  const warningDeadlineRef = useRef<number>(0);
  // isWarning lưu thêm ở ref để handleActivity đọc được giá trị mới nhất
  // MÀ KHÔNG cần re-subscribe listener. Nếu put isWarning vào useEffect deps,
  // khi modal mở → effect rerun → cleanup kill luôn countdown interval vừa tạo
  // → modal đứng im chờ setTimeout 90s mới đếm (bug user gặp).
  const isWarningRef = useRef(isWarning);
  isWarningRef.current = isWarning;
  // enabledRef để dismissWarning kiểm tra trước khi schedule timer mới —
  // tránh bug warning hiện trên route exempt sau khi user kết thúc phiên.
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  // Giữ callback mới nhất trong ref để không phải bind lại listener khi parent re-render.
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (!enabled) {
      // Hook bị disable giữa chừng (navigate sang route exempt): reset
      // warning state + clear mọi timer đang chạy để modal không còn visible.
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      if (warningIntervalRef.current !== null) {
        window.clearInterval(warningIntervalRef.current);
        warningIntervalRef.current = null;
      }
      setIsWarning(false);
      return;
    }

    const clearIdleTimer = () => {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };

    const clearWarningInterval = () => {
      if (warningIntervalRef.current !== null) {
        window.clearInterval(warningIntervalRef.current);
        warningIntervalRef.current = null;
      }
    };

    const triggerTimeout = () => {
      clearIdleTimer();
      clearWarningInterval();
      setIsWarning(false);
      onTimeoutRef.current();
    };

    const startWarningCountdown = () => {
      warningDeadlineRef.current = Date.now() + warningMs;
      setWarningRemainingMs(warningMs);
      setIsWarning(true);
      // Tick mỗi 100ms cho progress bar update mượt + số giây hiển thị đồng bộ
      // với thực tế. Tránh cảm giác "đứng yên 1 giây đầu tiên".
      const tick = () => {
        const remaining = warningDeadlineRef.current - Date.now();
        if (remaining <= 0) {
          triggerTimeout();
        } else {
          setWarningRemainingMs(remaining);
        }
      };
      warningIntervalRef.current = window.setInterval(tick, 100);
    };

    const startIdleTimer = () => {
      clearIdleTimer();
      idleTimerRef.current = window.setTimeout(() => {
        startWarningCountdown();
      }, idleMs);
    };

    const handleActivity = () => {
      // Trong warning state, activity KHÔNG tự reset — user phải click nút
      // "Tôi vẫn ở đây" để confirm (tránh accidental touch).
      if (isWarningRef.current) return;
      startIdleTimer();
    };

    startIdleTimer();

    const events: (keyof DocumentEventMap)[] = ['pointerdown', 'touchstart', 'keydown'];
    events.forEach((event) => document.addEventListener(event, handleActivity));

    return () => {
      clearIdleTimer();
      clearWarningInterval();
      events.forEach((event) => document.removeEventListener(event, handleActivity));
    };
    // Deps chỉ gồm enabled + idleMs + warningMs — KHÔNG thêm isWarning,
    // tránh re-run effect làm chết countdown interval (xem note isWarningRef).
  }, [enabled, idleMs, warningMs]);

  /** User confirm vẫn ở đây → tắt warning, khởi lại idle timer.
   *  Wrap useCallback để stable reference — consumer có thể put vào deps. */
  const dismissWarning = useCallback(() => {
    if (warningIntervalRef.current !== null) {
      window.clearInterval(warningIntervalRef.current);
      warningIntervalRef.current = null;
    }
    setIsWarning(false);
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    // Chỉ schedule idle timer mới khi hook đang enabled — tránh bug warning
    // re-xuất hiện trên route exempt (login, success, scan-guide) sau khi
    // user kết thúc phiên / navigate sang exempt route.
    if (!enabledRef.current) return;
    idleTimerRef.current = window.setTimeout(() => {
      // Trigger tương đương startWarningCountdown nhưng inline ở đây để
      // không phải expose function qua closure — đơn giản hơn.
      warningDeadlineRef.current = Date.now() + warningMs;
      setWarningRemainingMs(warningMs);
      setIsWarning(true);
      const tick = () => {
        const remaining = warningDeadlineRef.current - Date.now();
        if (remaining <= 0) {
          if (warningIntervalRef.current !== null) {
            window.clearInterval(warningIntervalRef.current);
            warningIntervalRef.current = null;
          }
          setIsWarning(false);
          onTimeoutRef.current();
        } else {
          setWarningRemainingMs(remaining);
        }
      };
      warningIntervalRef.current = window.setInterval(tick, 100);
    }, idleMs);
  }, [idleMs, warningMs]);

  return {
    isWarning,
    warningRemainingMs,
    dismissWarning,
  };
}
