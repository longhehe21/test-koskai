import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  /** Class tên overlay — để dùng style sẵn có trong UI repo. */
  overlayClassName: string;
  /** Class tên khi hiển thị (thường overlay + "--visible"). */
  visibleClassName: string;
  /** Thời gian mờ dần khi đóng (ms) — khớp với animation CSS. */
  closeDurationMs?: number;
  /** Có đóng khi click ngoài không. Default true. */
  closeOnBackdrop?: boolean;
  children: ReactNode;
}

/**
 * Base modal Portal — render vào document.body.
 * Mount với class overlay ẩn → tick requestAnimationFrame → thêm class visible
 * (match animation fade-in của UI repo CSS).
 */
export function Modal({
  open,
  onClose,
  overlayClassName,
  visibleClassName,
  closeDurationMs = 250,
  closeOnBackdrop = true,
  children,
}: ModalProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), closeDurationMs);
    return () => window.clearTimeout(timer);
  }, [open, closeDurationMs]);

  if (!mounted) return null;

  const classes = visible ? `${overlayClassName} ${visibleClassName}` : overlayClassName;

  return createPortal(
    <div
      className={classes}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
