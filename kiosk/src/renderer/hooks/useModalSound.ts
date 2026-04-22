import { useEffect, useRef } from 'react';
import { sound } from '@services/soundService';
import { hideVirtualKeyboard } from '@utils/keyboardControl';

/**
 * Hook chia sẻ cho mọi modal — phát pop/swoosh sound + ẩn virtual keyboard.
 * Track prev state qua ref để phân biệt transition open → close vs vice versa.
 *
 * @param open   Modal state hiện tại
 * @param hideKeyboardOnOpen Có ẩn bàn phím ảo khi modal mở không. Mặc định true
 *                            (hầu hết modal che form input → nên ẩn).
 */
export function useModalSound(open: boolean, hideKeyboardOnOpen = true) {
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      sound.modalOpen();
      if (hideKeyboardOnOpen) hideVirtualKeyboard();
    } else if (!open && prevOpenRef.current) {
      sound.modalClose();
    }
    prevOpenRef.current = open;
  }, [open, hideKeyboardOnOpen]);
}
