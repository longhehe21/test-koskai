/**
 * CccdScanPage — UI giả lập đọc chip CCCD qua đầu đọc NFC.
 *
 * Flow:
 *  1. idle    — hiển thị CCCD ảo + hướng dẫn, nút "Bắt đầu quét chip"
 *  2. scanning — beam + NFC pulse, progress 0→100%, các field decode dần
 *  3. success — load MOCK_USER vào sessionUserStore, nút "Hoàn tất — Tiếp tục"
 *
 * Production: thay bằng IPC tới NFC reader thật (đọc 17 trường + ảnh chân dung).
 * Dev/UI-only: dùng MOCK_USER (xem store/sessionUserStore.ts) — chỉnh trong file đó
 * hoặc override qua env RENDERER_VITE_MOCK_CCCD/_HOTEN/... nếu muốn.
 */
import '@styles/pages/cccd-scan.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import { useSessionUserStore, MOCK_USER } from '@store/sessionUserStore';

type Phase = 'idle' | 'scanning' | 'success';

interface ScanStep {
  at: number; // % progress
  label: string;
}

// Các bước decode hiển thị ở status bar — sát với quy trình thật của eID:
// detect → BAC/PACE → đọc DG → xác thực chữ ký số (PA/CA) → done
const SCAN_STEPS: ScanStep[] = [
  { at: 0, label: 'Phát hiện chip NFC...' },
  { at: 22, label: 'Thiết lập kênh bảo mật (PACE)...' },
  { at: 48, label: 'Đọc dữ liệu cá nhân (DG1, DG2)...' },
  { at: 74, label: 'Xác thực chữ ký số (Passive Auth)...' },
  { at: 100, label: 'Hoàn tất xác thực' },
];

const SCAN_DURATION_MS = 3600;
const AUTO_CONTINUE_MS = 1400;

interface ReadoutField {
  label: string;
  value: string;
  mono?: boolean;
}

export default function CccdScanPage() {
  const navigate = useNavigate();
  const setUser = useSessionUserStore((s) => s.setUser);

  usePageHeader({
    title: 'Quét CCCD gắn chip',
    showUserBadge: false,
    showDocs: false,
  });

  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  // Số field đã decode xong (stream hiệu ứng)
  const [revealed, setRevealed] = useState(0);

  const rafRef = useRef<number | null>(null);
  const autoNavRef = useRef<number | null>(null);

  const fields: ReadoutField[] = useMemo(
    () => [
      { label: 'Số định danh',  value: MOCK_USER.cccd, mono: true },
      { label: 'Họ và tên',     value: MOCK_USER.hoTen },
      { label: 'Ngày sinh',     value: MOCK_USER.ngaySinh, mono: true },
      { label: 'Giới tính',     value: MOCK_USER.gioiTinh },
      { label: 'Quốc tịch',     value: MOCK_USER.quocTich },
      { label: 'Dân tộc',       value: MOCK_USER.danToc },
      {
        label: 'Quê quán',
        value: `${MOCK_USER.thuongTru.diaChi}, ${MOCK_USER.thuongTru.ward}, ${MOCK_USER.thuongTru.province}`,
      },
      { label: 'Ngày cấp', value: MOCK_USER.ngayCap ?? '—', mono: true },
    ],
    [],
  );

  useEffect(() => {
    return () => {
      // Cleanup animation/timer khi unmount để tránh leak
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (autoNavRef.current !== null) window.clearTimeout(autoNavRef.current);
    };
  }, []);

  const handleStart = () => {
    if (phase !== 'idle') return;
    setPhase('scanning');
    setProgress(0);
    setRevealed(0);

    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(100, ((now - start) / SCAN_DURATION_MS) * 100);
      setProgress(p);
      setRevealed(Math.floor((p / 100) * fields.length));
      if (p < 100) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        handleComplete();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const handleComplete = () => {
    setRevealed(fields.length);
    setProgress(100);
    setPhase('success');
    setUser(MOCK_USER);
    // Auto chuyển sang verify sau ngắt nhỏ để user thấy state success
    autoNavRef.current = window.setTimeout(() => {
      navigate('/cccd-verify');
    }, AUTO_CONTINUE_MS + 600);
  };

  const handleContinue = () => {
    if (autoNavRef.current !== null) window.clearTimeout(autoNavRef.current);
    navigate('/cccd-verify');
  };

  // Tìm step hiện tại theo progress (đi ngược để lấy step có ngưỡng cao nhất)
  const currentStep =
    [...SCAN_STEPS].reverse().find((s) => progress >= s.at) ?? SCAN_STEPS[0];

  // Card field reveal — sync với readout (revealed counter).
  // Map card field → readout index; fields được unmask khi readout đã đọc qua index đó.
  const cardShown = (idx: number): boolean => phase !== 'idle' && revealed > idx;
  // class helper: thêm 'is-masked' khi chưa reveal, 'is-decoding' khi đúng đang đọc tới
  const cardCls = (idx: number): string => {
    if (!cardShown(idx)) return 'is-masked';
    if (phase === 'scanning' && revealed === idx + 1) return 'is-decoding';
    return '';
  };

  return (
    <div className="ccs-area">
      <div className="ccs-bg-grid" aria-hidden />
      <div className="ccs-bg-glow" aria-hidden />

      <header className="ccs-header">
        <h1 className="ccs-title">Quét căn cước công dân gắn chip</h1>
        <p className="ccs-subtitle">
          Đặt mặt trước thẻ CCCD vào đầu đọc NFC. Hệ thống sẽ tự động đọc và xác thực
          dữ liệu trên chip.
        </p>
        <div className={`ccs-status ccs-status--${phase}`}>
          <span className="ccs-status-dot" />
          <span className="ccs-status-text">
            {phase === 'idle' && 'Sẵn sàng quét'}
            {phase === 'scanning' && currentStep.label}
            {phase === 'success' && 'Đã xác thực thành công'}
          </span>
        </div>
      </header>

      <main className="ccs-stage">
        {/* ===== Card visual ===== */}
        <div className={`ccs-card-wrap ccs-card-wrap--${phase}`}>
          <div className="ccs-nfc-rings" aria-hidden>
            <span />
            <span />
            <span />
          </div>

          <div className="ccs-card">
            {/* Vietnam map watermark + decorative pattern */}
            <div className="ccs-card-map" aria-hidden>
              <svg viewBox="0 0 200 280" preserveAspectRatio="xMidYMid meet">
                <path
                  d="M115 18 Q130 28 128 45 Q124 60 132 72 Q140 82 138 96 Q132 110 122 118 Q108 128 100 142 Q94 158 102 172 Q112 186 108 202 Q98 218 86 232 Q72 248 80 262 Q90 270 78 274 Q66 270 60 256 Q56 240 64 226 Q74 210 80 194 Q84 178 76 164 Q70 150 80 138 Q92 126 98 112 Q104 96 96 82 Q88 70 96 58 Q108 46 110 30 Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                <circle cx="78" cy="270" r="2.5" fill="currentColor" />
                <circle cx="138" cy="60" r="2" fill="currentColor" />
              </svg>
            </div>
            <div className="ccs-card-pattern" aria-hidden />

            {/* Header: emblem + national titles + QR */}
            <div className="ccs-card-header">
              <div className="ccs-card-emblem" aria-hidden>
                <svg viewBox="0 0 40 40" width="38" height="38">
                  <circle cx="20" cy="20" r="18" fill="#dc2626" />
                  <circle cx="20" cy="20" r="13.5" fill="none" stroke="#fde047" strokeWidth="0.7" />
                  <polygon
                    points="20,9 22.4,16.4 30.2,16.4 23.9,21 26.3,28.4 20,23.8 13.7,28.4 16.1,21 9.8,16.4 17.6,16.4"
                    fill="#fde047"
                  />
                  <path
                    d="M11 28 Q20 31 29 28"
                    fill="none"
                    stroke="#fde047"
                    strokeWidth="0.6"
                  />
                </svg>
              </div>

              <div className="ccs-card-titles">
                <span className="ccs-cardline-cap">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</span>
                <strong className="ccs-cardline-motto">Độc lập - Tự do - Hạnh phúc</strong>
                <span className="ccs-cardline-en">SOCIALIST REPUBLIC OF VIET NAM</span>
                <span className="ccs-cardline-en">Independence - Freedom - Happiness</span>
              </div>

              <div className="ccs-card-qr" aria-hidden>
                <svg viewBox="0 0 21 21" width="40" height="40">
                  <rect width="21" height="21" fill="#ffffff" />
                  {/* 3 finder patterns */}
                  <rect x="0" y="0" width="7" height="7" fill="#0f172a" />
                  <rect x="1" y="1" width="5" height="5" fill="#fff" />
                  <rect x="2" y="2" width="3" height="3" fill="#0f172a" />
                  <rect x="14" y="0" width="7" height="7" fill="#0f172a" />
                  <rect x="15" y="1" width="5" height="5" fill="#fff" />
                  <rect x="16" y="2" width="3" height="3" fill="#0f172a" />
                  <rect x="0" y="14" width="7" height="7" fill="#0f172a" />
                  <rect x="1" y="15" width="5" height="5" fill="#fff" />
                  <rect x="2" y="16" width="3" height="3" fill="#0f172a" />
                  {/* Pseudo-random data modules — fixed pattern */}
                  <g fill="#0f172a">
                    <rect x="9" y="0" width="1" height="1" /><rect x="11" y="0" width="1" height="1" />
                    <rect x="8" y="2" width="1" height="1" /><rect x="10" y="2" width="1" height="1" />
                    <rect x="12" y="2" width="1" height="1" />
                    <rect x="9" y="4" width="1" height="1" /><rect x="13" y="4" width="1" height="1" />
                    <rect x="8" y="6" width="2" height="1" /><rect x="11" y="6" width="1" height="1" />
                    <rect x="0" y="8" width="1" height="1" /><rect x="2" y="8" width="1" height="1" />
                    <rect x="4" y="8" width="1" height="1" /><rect x="6" y="8" width="1" height="1" />
                    <rect x="8" y="8" width="1" height="1" /><rect x="10" y="8" width="2" height="1" />
                    <rect x="14" y="8" width="1" height="1" /><rect x="16" y="8" width="1" height="1" />
                    <rect x="18" y="8" width="1" height="1" /><rect x="20" y="8" width="1" height="1" />
                    <rect x="9" y="9" width="1" height="2" /><rect x="13" y="9" width="1" height="1" />
                    <rect x="15" y="9" width="2" height="1" /><rect x="18" y="9" width="1" height="1" />
                    <rect x="8" y="11" width="1" height="1" /><rect x="11" y="11" width="2" height="1" />
                    <rect x="14" y="11" width="1" height="1" /><rect x="17" y="11" width="1" height="1" />
                    <rect x="9" y="13" width="2" height="1" /><rect x="12" y="13" width="1" height="1" />
                    <rect x="15" y="13" width="1" height="1" /><rect x="19" y="13" width="1" height="1" />
                    <rect x="8" y="15" width="1" height="1" /><rect x="10" y="15" width="1" height="1" />
                    <rect x="13" y="15" width="2" height="1" /><rect x="16" y="15" width="1" height="1" />
                    <rect x="18" y="15" width="2" height="1" />
                    <rect x="9" y="17" width="1" height="1" /><rect x="11" y="17" width="1" height="1" />
                    <rect x="14" y="17" width="1" height="1" /><rect x="17" y="17" width="1" height="1" />
                    <rect x="20" y="17" width="1" height="1" />
                    <rect x="8" y="19" width="2" height="1" /><rect x="12" y="19" width="2" height="1" />
                    <rect x="15" y="19" width="1" height="1" /><rect x="18" y="19" width="1" height="1" />
                    <rect x="20" y="19" width="1" height="1" />
                  </g>
                </svg>
              </div>
            </div>

            {/* Main title */}
            <div className="ccs-card-titlemain">
              <strong>CĂN CƯỚC CÔNG DÂN</strong>
              <span className="ccs-card-titlemain-en">
                Citizen Identity Card
                <span className="ccs-card-chipmini" aria-hidden>
                  <svg viewBox="0 0 16 12" width="14" height="11">
                    <defs>
                      <linearGradient id="ccs-chipMiniGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#fde68a" />
                        <stop offset="1" stopColor="#b45309" />
                      </linearGradient>
                    </defs>
                    <rect width="16" height="12" rx="2" fill="url(#ccs-chipMiniGrad)" />
                    <path d="M0 4 H16 M0 8 H16 M5 0 V12 M11 0 V12" stroke="rgba(0,0,0,.35)" strokeWidth="0.4" fill="none" />
                  </svg>
                </span>
              </span>
            </div>

            {/* Body: photo + fields */}
            <div className="ccs-card-body">
              <div className="ccs-card-photo" aria-hidden>
                <svg viewBox="0 0 24 24" width="36" height="36">
                  <path
                    d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-3.3 0-9 1.7-9 5v1h18v-1c0-3.3-5.7-5-9-5Z"
                    fill="rgba(15,23,42,.4)"
                  />
                </svg>
              </div>

              <div className="ccs-card-fields">
                <div className="ccs-card-line">
                  <i>Số / No.</i>
                  <b className={`ccs-card-no ${cardCls(0)}`.trim()}>
                    {cardShown(0) ? MOCK_USER.cccd : '•••• •••• ••••'}
                  </b>
                </div>
                <div className="ccs-card-line">
                  <i>Họ và tên / Full name</i>
                  <b className={cardCls(1)}>
                    {cardShown(1) ? MOCK_USER.hoTen : '•••••••••••••••••'}
                  </b>
                </div>
                <div className="ccs-card-line ccs-card-line--two">
                  <span>
                    <i>Ngày sinh / Date of birth</i>
                    <b className={cardCls(2)}>
                      {cardShown(2) ? MOCK_USER.ngaySinh : '••/••/••••'}
                    </b>
                  </span>
                  <span>
                    <i>Giới tính / Sex</i>
                    <b className={cardCls(3)}>
                      {cardShown(3) ? MOCK_USER.gioiTinh : '•••'}
                    </b>
                  </span>
                  <span>
                    <i>Quốc tịch / Nationality</i>
                    <b className={cardCls(4)}>
                      {cardShown(4) ? MOCK_USER.quocTich : '••••• •••'}
                    </b>
                  </span>
                </div>
                <div className="ccs-card-line">
                  <i>Quê quán / Place of origin</i>
                  <b className={cardCls(6)}>
                    {cardShown(6)
                      ? `${MOCK_USER.thuongTru.ward}, ${MOCK_USER.thuongTru.province}`
                      : '•••••••••••••••••••••••••••••••'}
                  </b>
                </div>
                <div className="ccs-card-line">
                  <i>Nơi thường trú / Place of residence</i>
                  <b className={cardCls(6)}>
                    {cardShown(6)
                      ? `${MOCK_USER.thuongTru.diaChi}, ${MOCK_USER.thuongTru.ward}, ${MOCK_USER.thuongTru.province}`
                      : '••••••••••••••••••••••••••••••••••'}
                  </b>
                </div>
              </div>
            </div>

            {/* Bottom: expiry — reveal cuối cùng */}
            <div className="ccs-card-expiry">
              <span>
                <i>Có giá trị đến / Date of expiry:</i>
                <b className={cardCls(7)}>
                  {cardShown(7) ? '02/04/2046' : '••/••/••••'}
                </b>
              </span>
            </div>

            <div className="ccs-scan-beam" aria-hidden />
            <div className="ccs-scan-shine" aria-hidden />
          </div>

          <div className="ccs-reader" aria-hidden>
            <div className="ccs-reader-line" />
            <span className="ccs-reader-label">NFC READER</span>
          </div>
        </div>

        {/* ===== Data readout ===== */}
        <aside className="ccs-readout">
          <div className="ccs-readout-head">
            <span className={`ccs-readout-dot ccs-readout-dot--${phase}`} />
            <span className="ccs-readout-title">Dữ liệu chip CCCD</span>
            <span className="ccs-readout-meta">eID v2.0 · RSA-2048</span>
          </div>

          <ul className="ccs-readout-list">
            {fields.map((f, i) => {
              const visible = i < revealed;
              const isCurrent = phase === 'scanning' && i === revealed;
              return (
                <li
                  key={f.label}
                  className={`ccs-readout-item${visible ? ' is-visible' : ''}${isCurrent ? ' is-current' : ''}`}
                >
                  <span className="ccs-readout-label">{f.label}</span>
                  {visible ? (
                    <span className={`ccs-readout-value${f.mono ? ' is-mono' : ''}`}>
                      {f.value}
                    </span>
                  ) : (
                    <span className="ccs-readout-skeleton" />
                  )}
                </li>
              );
            })}
          </ul>

          <div className="ccs-progress">
            <div className="ccs-progress-track">
              <div className="ccs-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="ccs-progress-pct">{Math.round(progress)}%</span>
          </div>
        </aside>
      </main>

      <footer className="ccs-footer">
        <button
          type="button"
          className="ccs-btn ccs-btn--ghost"
          onClick={() => navigate(-1)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Quay lại
        </button>

        {phase === 'idle' && (
          <button
            type="button"
            className="ccs-btn ccs-btn--primary"
            onClick={handleStart}
          >
            <span className="ccs-btn-pulse" aria-hidden />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12.55a11 11 0 0 1 14.08 0" />
              <path d="M1.42 9a16 16 0 0 1 21.16 0" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
            Bắt đầu quét chip
          </button>
        )}

        {phase === 'scanning' && (
          <button type="button" className="ccs-btn ccs-btn--primary" disabled>
            <span className="ccs-spinner" aria-hidden />
            Đang đọc dữ liệu...
          </button>
        )}

        {phase === 'success' && (
          <button
            type="button"
            className="ccs-btn ccs-btn--success"
            onClick={handleContinue}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Hoàn tất — Tiếp tục
          </button>
        )}
      </footer>
    </div>
  );
}
