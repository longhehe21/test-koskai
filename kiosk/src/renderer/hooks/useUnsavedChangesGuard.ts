import { useState, useCallback } from 'react';

type LeaveAction = () => void;

/**
 * Guard rời khỏi trang khi form có dữ liệu chưa lưu. Dùng pattern "intercept":
 *  - `guard(action)` — gọi thay cho action gốc (vd navigate). Nếu form dirty,
 *     action được pending lại cho đến khi user confirm; nếu clean thì chạy luôn.
 *  - `proceed()` — user chọn "Hủy bỏ / Không lưu" → chạy action đã pending.
 *  - `cancel()` — user chọn "Tiếp tục chỉnh sửa" → hủy action, ở lại trang.
 *  - `isPrompting` — đang hiện modal xác nhận hay không.
 *
 * Ví dụ dùng trong form page:
 *   const { guard, proceed, cancel, isPrompting } = useUnsavedChangesGuard(isDirty);
 *   <FormFooter onBack={() => guard(() => navigate(-1))} />
 *   <UnsavedChangesModal open={isPrompting} onClose={cancel} onDiscard={proceed} ... />
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  const [pending, setPending] = useState<LeaveAction | null>(null);

  const guard = useCallback(
    (action: LeaveAction) => {
      if (isDirty) {
        // setState với function → store callback không bị invoke làm updater.
        setPending(() => action);
      } else {
        action();
      }
    },
    [isDirty],
  );

  const proceed = useCallback(() => {
    setPending((current) => {
      current?.();
      return null;
    });
  }, []);

  const cancel = useCallback(() => setPending(null), []);

  return {
    guard,
    proceed,
    cancel,
    isPrompting: pending !== null,
  };
}
