/**
 * Font scale service — accessibility cho người già / khiếm thị nhẹ.
 * Apply qua CSS custom property `--kiosk-font-scale` trên :root, global.css
 * dùng biến này để scale font-size toàn app.
 *
 * Persist qua localStorage để giữ preference qua session.
 */

const STORAGE_KEY = 'kiosk.fontScale';
const MIN_SCALE = 1.0;
const MAX_SCALE = 1.3;
const STEP = 0.1;

let currentScale = loadInitialScale();
const listeners = new Set<(scale: number) => void>();

function clamp(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(value * 10) / 10));
}

function loadInitialScale(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = parseFloat(raw);
      if (!Number.isNaN(parsed)) return clamp(parsed);
    }
  } catch {
    /* private mode / storage disabled — fallback default */
  }
  return MIN_SCALE;
}

function applyToDocument(scale: number): void {
  document.documentElement.style.setProperty('--kiosk-font-scale', String(scale));
}

// Apply ngay khi module load để layout render đúng font size từ đầu.
applyToDocument(currentScale);

export function getFontScale(): number {
  return currentScale;
}

export function setFontScale(scale: number): void {
  const next = clamp(scale);
  if (next === currentScale) return;
  currentScale = next;
  applyToDocument(next);
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(next));
}

export function increaseFontScale(): void {
  setFontScale(currentScale + STEP);
}

export function decreaseFontScale(): void {
  setFontScale(currentScale - STEP);
}

export function subscribeFontScale(listener: (scale: number) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const FONT_SCALE_MIN = MIN_SCALE;
export const FONT_SCALE_MAX = MAX_SCALE;
