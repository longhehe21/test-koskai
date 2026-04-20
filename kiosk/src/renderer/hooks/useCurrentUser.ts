import { useSessionUserStore, MOCK_USER, type SessionUser } from '@store/sessionUserStore';

/**
 * Trả về SessionUser hiện tại. Fallback MOCK_USER trong giai đoạn UI-only
 * (NFC reader chưa wire). Khi backend restored, MOCK fallback sẽ xóa.
 */
export function useCurrentUser(): SessionUser {
  const user = useSessionUserStore((s) => s.user);
  return user ?? MOCK_USER;
}
