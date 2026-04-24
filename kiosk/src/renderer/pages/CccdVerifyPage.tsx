/**
 * CccdVerifyPage — xác thực CCCD + khuôn mặt.
 *
 * Logic face verify (mock, chưa có API Bộ Công an):
 *  1. Mount → xin permission camera → bật <video>
 *  2. Polling 500ms: motion detection (32x32 grayscale diff) → detect face stable
 *  3. Stable 4 frame liên tiếp (2s) → auto trigger analyze
 *  4. Analyze: 2s progress (scan line chạy) → success 97% score
 *  5. Matched → enable nút "Xác nhận & Tiếp tục"
 *
 * Bảo mật: ảnh camera chỉ tồn tại trong RAM (video.srcObject),
 * không lưu dataURL vào store — khớp feedback_data_security.
 *
 * Production: sẽ thay analyze bằng API bên thứ 3 (face match + liveness).
 */
import '@styles/pages/cccd-verify.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '@hooks/usePageHeader';
import { useCurrentUser } from '@hooks/useCurrentUser';
import { useSessionUserStore } from '@store/sessionUserStore';

const SERVER_URL = (import.meta.env.RENDERER_VITE_SERVER_URL as string | undefined)
  ?? 'http://localhost:3000';

interface InfoRow {
  label: string;
  value: string;
  iconPath: JSX.Element;
}

type VerifyMode = 'idle' | 'detecting' | 'analyzing' | 'matched' | 'failed';

// Motion diff cao hơn SCAN_MOTION vì khuôn mặt luôn cử động nhẹ (hô hấp, mắt)
const STABLE_DIFF_THRESHOLD = 12;
const STABLE_REQUIRED_TICKS = 4; // 4 × 500ms = 2s
const POLL_INTERVAL_MS = 500;
const ANALYZE_DURATION_MS = 2200;

export default function CccdVerifyPage() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const setSession = useSessionUserStore((s) => s.setSession);

  usePageHeader({
    title: 'Xác thực CCCD',
    showUserBadge: false,
    showDocs: false,
  });

  const [mode, setMode] = useState<VerifyMode>('idle');
  const [matchScore, setMatchScore] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastFrameRef = useRef<Uint8ClampedArray | null>(null);
  const stableCountRef = useRef(0);
  const analyzeTimerRef = useRef<number | null>(null);
  const modeRef = useRef<VerifyMode>('idle');

  useEffect(() => { modeRef.current = mode; }, [mode]);

  // Bước 1: Start camera on mount
  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setMode('detecting');
      } catch (err) {
        setError(`Không truy cập được camera: ${(err as Error).message}`);
        setMode('idle');
      }
    }
    start();

    return () => {
      cancelled = true;
      if (analyzeTimerRef.current) {
        clearTimeout(analyzeTimerRef.current);
        analyzeTimerRef.current = null;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  // Bước 2: trigger analyze — 2.2s mock → match → gọi API tạo session → auto navigate /services
  const startAnalyze = useCallback(() => {
    if (modeRef.current !== 'detecting') return;
    setMode('analyzing');
    analyzeTimerRef.current = window.setTimeout(async () => {
      // Mock face match 95-99% success
      const score = 95 + Math.random() * 4;
      setMatchScore(Math.round(score * 10) / 10);
      setMode('matched');
      analyzeTimerRef.current = null;

      // Tạo session backend. Nếu API fail → vẫn navigate (fail-open cho demo).
      try {
        const res = await fetch(`${SERVER_URL}/sessions/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cccd: user.cccd,
            loginMethod: 'cccd_nfc',
            identityVerified: true,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setSession(data.sessionToken, data.citizenId);
        } else {
          console.warn('[CccdVerify] session create HTTP', res.status);
        }
      } catch (err) {
        console.warn('[CccdVerify] session create fail:', (err as Error).message);
      }

      // Auto navigate sang /services sau khi show match 1.5s
      window.setTimeout(() => navigate('/services'), 1500);
    }, ANALYZE_DURATION_MS);
  }, [navigate, setSession, user.cccd]);

  // Bước 3: Polling loop — motion stable → auto trigger analyze
  useEffect(() => {
    const id = setInterval(() => {
      if (modeRef.current !== 'detecting') return;
      const v = videoRef.current;
      if (!v || v.readyState < 2 || v.videoWidth === 0) return;

      const diff = computeFaceMotionDiff(v, lastFrameRef);
      if (diff === null) return; // lần đầu, baseline

      if (diff < STABLE_DIFF_THRESHOLD) {
        stableCountRef.current += 1;
        if (stableCountRef.current >= STABLE_REQUIRED_TICKS) {
          stableCountRef.current = 0;
          startAnalyze();
        }
      } else {
        stableCountRef.current = 0; // reset khi có chuyển động lớn
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [startAnalyze]);

  // Retry khi failed (tương lai dùng cho case mock fail) — hiện auto match 100%, nên chưa kích hoạt
  void (() => {
    if (analyzeTimerRef.current) {
      clearTimeout(analyzeTimerRef.current);
      analyzeTimerRef.current = null;
    }
    stableCountRef.current = 0;
    lastFrameRef.current = null;
    setMatchScore(0);
    setMode('detecting');
  });

  const rows: InfoRow[] = [
    {
      label: 'HỌ TÊN',
      value: user.hoTen,
      iconPath: (
        <>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </>
      ),
    },
    {
      label: 'SỐ CCCD',
      value: user.cccd,
      iconPath: (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="7" y1="8" x2="17" y2="8" />
          <line x1="7" y1="12" x2="13" y2="12" />
        </>
      ),
    },
    {
      label: 'NGÀY SINH',
      value: user.ngaySinh,
      iconPath: (
        <>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </>
      ),
    },
    {
      label: 'GIỚI TÍNH',
      value: user.gioiTinh,
      iconPath: (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="10" cy="7" r="4" />
        </>
      ),
    },
    {
      label: 'ĐỊA CHỈ',
      value: [user.thuongTru.diaChi, user.thuongTru.ward, user.thuongTru.province]
        .filter(Boolean)
        .join(', '),
      iconPath: (
        <>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </>
      ),
    },
  ];

  const frameClass = `ekyc-frame${mode === 'analyzing' ? ' is-analyzing' : ''
    }${mode === 'matched' ? ' is-matched' : ''
    }${mode === 'failed' ? ' is-failed' : ''}`;

  const hint = (() => {
    if (error) return null;
    if (mode === 'idle') return 'Đang khởi động camera...';
    if (mode === 'detecting') return 'Vui lòng nhìn thẳng vào camera, giữ khuôn mặt ổn định';
    if (mode === 'analyzing') return 'Đang so khớp khuôn mặt với ảnh CCCD...';
    if (mode === 'matched') return 'Xác thực thành công! Đang chuyển sang dịch vụ...';
    if (mode === 'failed') return 'Xác thực thất bại — thử lại';
    return '';
  })();

  const hintClass = `ekyc-hint${mode === 'analyzing' ? ' is-analyzing' : ''
    }${mode === 'matched' ? ' is-matched' : ''
    }${mode === 'failed' ? ' is-failed' : ''}`;

  return (
    <div className="cccd-verify-area">
      <div className="cccd-header-section">
        <div className="cccd-verify-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="12" fill="#2563eb" />
            <path
              d="M7 13l3 3 7-7"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="cccd-verify-title">Xác thực khuôn mặt với ảnh CCCD</h1>
        <p className="cccd-verify-subtitle">
          Hệ thống sẽ so sánh khuôn mặt thực tế của bạn với ảnh đã nhập từ CCCD.
        </p>
      </div>

      <div className="cccd-main-card">
        <h2 className="face-section-title">XÁC THỰC SINH TRẮC HỌC</h2>

        <div className="cccd-card-body">
          <div className="cccd-ekyc-side">
            <div className={frameClass}>
              <div className="ekyc-video-layer">
                <video ref={videoRef} className="ekyc-video" muted playsInline />
              </div>
              <div className="ekyc-overlay-mask" />
              <div className="ekyc-guide-ui">
                <div className="ekyc-corner ekyc-corner-tl" />
                <div className="ekyc-corner ekyc-corner-tr" />
                <div className="ekyc-corner ekyc-corner-bl" />
                <div className="ekyc-corner ekyc-corner-br" />
              </div>
              <svg className="ekyc-dashed-circle" viewBox="0 0 200 200">
                <circle
                  cx="100"
                  cy="100"
                  r="88"
                  fill="none"
                  stroke={mode === 'matched'
                    ? 'rgba(37, 99, 235, 0.65)'
                    : mode === 'analyzing'
                      ? 'rgba(59, 130, 246, 0.7)'
                      : 'rgba(148,163,184,0.5)'}
                  strokeWidth="1.5"
                  strokeDasharray="6 4"
                />
              </svg>
              {mode === 'analyzing' && <div className="ekyc-scan-line" />}
              {mode === 'matched' && (
                <div className="ekyc-result-badge is-matched">
                  <div className="ekyc-result-badge-icon">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 12l5 5L20 7"
                        stroke="#ffffff"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="ekyc-result-badge-score">{matchScore}%</div>
                  <div className="ekyc-result-badge-text">TRÙNG KHỚP</div>
                </div>
              )}
              {mode === 'failed' && (
                <div className="ekyc-result-badge is-failed">
                  <div className="ekyc-result-badge-icon">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M6 6l12 12M18 6L6 18"
                        stroke="#ffffff"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <div className="ekyc-result-badge-text">KHÔNG KHỚP</div>
                </div>
              )}
            </div>
            <p className={hintClass}>{hint}</p>
            {error && <div className="ekyc-error">❌ {error}</div>}
          </div>

          <div className="cccd-info-side">
            <div className="cccd-info-layout">
              <div className="cccd-photo">
                <img src={user.photoSrc} alt={user.hoTen} className="cccd-photo-img" />
              </div>
              <div className="cccd-info-grid">
                {rows.map((row) => (
                  <div key={row.label} className="cccd-info-row">
                    <span className="cccd-info-label">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        {row.iconPath}
                      </svg>
                      {row.label}
                    </span>
                    <span className="cccd-info-value">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

/**
 * Tính motion diff giữa 2 frame liên tiếp (downscale 32x32 grayscale).
 * Đo độ ổn định của khuôn mặt → threshold thấp = mặt đứng yên.
 */
function computeFaceMotionDiff(
  video: HTMLVideoElement,
  lastFrameRef: MutableRefObject<Uint8ClampedArray | null>,
): number | null {
  const SIZE = 32;
  const tmp = document.createElement('canvas');
  tmp.width = SIZE;
  tmp.height = SIZE;
  const ctx = tmp.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, SIZE, SIZE);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

  const gray = new Uint8ClampedArray(SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  const prev = lastFrameRef.current;
  lastFrameRef.current = gray;
  if (!prev) return null;

  let total = 0;
  for (let i = 0; i < gray.length; i++) {
    total += Math.abs(gray[i] - prev[i]);
  }
  return total / gray.length;
}
