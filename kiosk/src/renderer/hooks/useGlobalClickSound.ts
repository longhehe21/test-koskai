import { useEffect } from 'react';
import { sound, type SoundActionType } from '@services/soundService';

/**
 * Global touch feedback — chạy 1 lần ở Layout, listen document pointerdown:
 *  1. **Sound** theo loại action (primary/secondary/destructive/default)
 *     detect qua className keywords — không phải wrap từng button
 *  2. **Ripple effect** (Material-ish) trên primary action buttons + cards
 *     — visual feedback touch point
 *
 * Skip:
 *  - Button disabled
 *  - Element có `data-no-sound="true"` (custom sound handler, vd star rating)
 */

/** Class patterns → action type. Match theo substring className. */
const ACTION_PATTERNS: Array<[RegExp, SoundActionType]> = [
  // Destructive trước (nếu class có "logout" + "btn--danger")
  [/danger|destructive|logout|--destructive/, 'destructive'],
  // Primary: submit, primary, confirm, next, print
  [/--submit|--primary|--confirm|--next|print-btn|home-btn/, 'primary'],
  // Secondary: back, cancel, outline, draft
  [/--back|--cancel|--outline|--draft|close/, 'secondary'],
];

function detectActionType(el: HTMLElement): SoundActionType {
  const cls = el.className;
  if (typeof cls !== 'string') return 'default';
  for (const [pattern, type] of ACTION_PATTERNS) {
    if (pattern.test(cls)) return type;
  }
  return 'default';
}

/** Selectors có ripple effect. Giới hạn main actions để tránh spam everywhere. */
const RIPPLE_SELECTOR = [
  '.nhstc-submit-btn',
  '.nhstc-home-btn',
  '.nhstc-print-btn',
  '.cutru-btn',
  '.cutru-card',
  '.hktrh-btn',
  '.hktrh-card',
  '.tkbtv-footer-btn',
  '.ttbl-ft-btn',
  '.csm-btn',
  '.ucm-btn',
  '.iwm-btn',
  '.ppm-btn',
  '.dsm-btn',
  '.hsct-home-btn',
  '.hsct-empty-btn',
  '.hsct-page-btn',
  '.header-user-badge',
  '.header-docs-btn',
  '.font-scale-btn',
].join(',');

function spawnRipple(btn: HTMLElement, clientX: number, clientY: number) {
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2;
  const ripple = document.createElement('span');
  ripple.className = 'kiosk-ripple';
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${clientX - rect.left - size / 2}px`;
  ripple.style.top = `${clientY - rect.top - size / 2}px`;
  btn.appendChild(ripple);
  // Cleanup sau khi animation xong để tránh leak DOM.
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
}

export function useGlobalClickSound() {
  useEffect(() => {
    const handler = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const btn = target.closest('button, [role="button"]') as HTMLElement | null;
      if (!btn) return;
      if (btn.hasAttribute('disabled')) return;
      if (btn.dataset.noSound === 'true') return;

      // Sound theo action type
      const actionType = detectActionType(btn);
      sound.action(actionType);

      // Ripple — chỉ main action buttons
      const rippleTarget = btn.closest(RIPPLE_SELECTOR) as HTMLElement | null;
      if (rippleTarget) {
        spawnRipple(rippleTarget, event.clientX, event.clientY);
      }
    };

    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, []);
}
