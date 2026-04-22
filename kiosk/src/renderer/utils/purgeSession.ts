import { useConversationStore } from '@store/conversationStore';
import { useHoKhauFlowStore } from '@store/hoKhauFlowStore';
import { useSessionUserStore } from '@store/sessionUserStore';
import { useTamTruFlowStore } from '@store/tamTruFlowStore';

/**
 * Xóa toàn bộ state + PII khỏi RAM khi session kết thúc (auto-logout,
 * user chủ động thoát, hoặc hoàn tất flow). Theo rule bảo mật trong
 * CLAUDE.md: "PII phải clear khi rời kiosk".
 *
 * Thứ tự xóa không quan trọng (các store độc lập).
 * Lưu ý: chỉ clear state trong RAM. Nếu có PII trong sessionStorage
 * persisted (hoKhauFlowStore, tamTruFlowStore), `clear()` của chúng
 * đã bao gồm xóa sessionStorage qua middleware persist.
 */
export function purgeSession(): void {
  useSessionUserStore.getState().clearUser();
  useConversationStore.getState().reset();
  useConversationStore.getState().clearMessages();
  useHoKhauFlowStore.getState().clear();
  useTamTruFlowStore.getState().clear();

  // Xóa thêm sessionStorage keys ngoài store (nếu có UI-state transient).
  try {
    sessionStorage.clear();
  } catch {
    /* ignore — không critical */
  }
}
