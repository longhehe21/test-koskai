/**
 * External control cho VirtualKeyboard — dùng custom event để tránh prop
 * drilling hoặc tạo global store. Component nào muốn ẩn keyboard (vd
 * IdleWarningModal, ConfirmSubmitModal full-screen) gọi hideVirtualKeyboard().
 */
const HIDE_EVENT = 'kiosk:hide-keyboard';

export function hideVirtualKeyboard(): void {
  window.dispatchEvent(new Event(HIDE_EVENT));
  // Blur active input — modal UI cần focus riêng, tránh giữ focus cũ.
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    active.blur();
  }
}

export function subscribeHideVirtualKeyboard(handler: () => void): () => void {
  window.addEventListener(HIDE_EVENT, handler);
  return () => window.removeEventListener(HIDE_EVENT, handler);
}
