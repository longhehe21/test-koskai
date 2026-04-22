/**
 * Confetti đơn giản — canvas-less, chỉ dùng DOM elements + CSS animation.
 * Bắn ~40 particles từ top center, rơi xuống với rotation + drift ngang.
 * Auto cleanup sau 2s. Không cần library ngoài.
 */

const COLORS = [
  '#2563eb', // primary blue
  '#22c55e', // success green
  '#f59e0b', // warning amber
  '#ec4899', // pink
  '#8b5cf6', // violet
];

export function fireConfetti(count = 40): void {
  if (typeof document === 'undefined') return;

  const layer = document.createElement('div');
  layer.className = 'kiosk-confetti-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);

  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'kiosk-confetti';
    // Mỗi particle random: start X, hướng bay, rotation, color, shape
    const startX = 40 + Math.random() * 20; // 40-60% horizontal
    const driftX = (Math.random() - 0.5) * 60; // -30 to +30 vw
    const rotate = Math.random() * 720 - 360; // -360° to 360°
    const delay = Math.random() * 150;
    const duration = 1200 + Math.random() * 600;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const isCircle = Math.random() > 0.7;
    p.style.cssText = `
      left: ${startX}%;
      top: 20%;
      background: ${color};
      border-radius: ${isCircle ? '50%' : '2px'};
      width: ${isCircle ? '8px' : '7px'};
      height: ${isCircle ? '8px' : '12px'};
      --drift-x: ${driftX}vw;
      --rotate: ${rotate}deg;
      animation-delay: ${delay}ms;
      animation-duration: ${duration}ms;
    `;
    layer.appendChild(p);
  }

  window.setTimeout(() => layer.remove(), 2500);
}
