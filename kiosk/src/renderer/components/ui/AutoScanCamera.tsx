/**
 * AutoScanCamera — camera scan tài liệu, user bấm "📷 Chụp" manual để capture.
 *
 * Flow:
 *  1. Mount → xin permission + auto-start stream
 *  2. User bấm "📷 Chụp":
 *     - Capture frame hiện tại (rotate 90° nếu cần)
 *     - Enhance (auto-levels + gamma + desaturate) như CamScanner
 *     - POST /scan/classify → OCR + match
 *     - Nếu có text (confidence hoặc length đủ) → mở modal Giữ/Chụp lại
 *     - Nếu OCR rỗng → toast "không đọc được text"
 *  3. Modal 2 nút:
 *     - "Chụp lại" → close modal, chụp tiếp
 *     - "Giữ ảnh" → callback onKeep(dataUrl, match, ocrText)
 *
 * Bỏ hẳn auto-polling + motion detection — tránh false positive (chụp linh tinh
 * khi ảnh vô tình ổn định). User control 100%.
 *
 * Cleanup: stop stream + abort fetch khi unmount.
 */
import '@styles/components/auto-scan-camera.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';

const SERVER_URL = (import.meta.env.RENDERER_VITE_SERVER_URL as string | undefined)
  ?? 'http://localhost:3000';

export interface MatchInfo {
  code: string;
  name: string;
  score: number;
  matchedKeywords: string[];
}

export interface ClassifyResult {
  ocrText: string;
  ocrConfidence: number;
  match: MatchInfo | null;
  procedureCode: string;
}

export interface AutoScanCameraProps {
  /** Code thủ tục — server lookup required_docs theo code này */
  procedureCode: string;
  /** Rotate 90° CW — default false (camera hiển thị native). User tự xoay phone nếu cần. */
  defaultRotate90?: boolean;
  /** User bấm "Giữ ảnh" → parent lưu dataUrl + match + OCR */
  onKeep: (dataUrl: string, match: MatchInfo | null, ocrText: string) => void;
}

type ScanMode = 'idle' | 'ready' | 'processing' | 'matched';

export function AutoScanCamera({
  procedureCode,
  defaultRotate90 = true,
  onKeep,
}: AutoScanCameraProps) {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [mode, setMode] = useState<ScanMode>('idle');
  const [capturedImg, setCapturedImg] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ClassifyResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnMsg, setWarnMsg] = useState<string | null>(null);
  const [scanAnim, setScanAnim] = useState(false);

  const rotate90 = defaultRotate90;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const procedureRef = useRef(procedureCode);

  useEffect(() => { procedureRef.current = procedureCode; }, [procedureCode]);

  // Load device + auto-start stream
  useEffect(() => {
    async function loadDevice() {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        const all = await navigator.mediaDevices.enumerateDevices();
        const cams = all.filter((d) => d.kind === 'videoinput');
        if (cams.length > 0) setSelectedDeviceId(cams[0].deviceId);
      } catch (err) {
        setError(`Không truy cập được camera: ${(err as Error).message}`);
      }
    }
    loadDevice();
  }, []);

  useEffect(() => {
    if (!selectedDeviceId) return;
    let cancelled = false;
    async function start() {
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: selectedDeviceId },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
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
        setMode('ready');
        setError(null);
      } catch (err) {
        setError(`Lỗi mở camera: ${(err as Error).message}`);
      }
    }
    start();
    return () => { cancelled = true; };
  }, [selectedDeviceId]);

  // Cleanup unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  // Trigger scan reveal animation cho modal
  const triggerAnim = useCallback(() => {
    setScanAnim(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setScanAnim(true));
    });
    setTimeout(() => setScanAnim(false), 1600);
  }, []);

  // Capture + OCR — user bấm "📷 Chụp"
  const handleCapture = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.readyState < 2 || video.videoWidth === 0) {
      setWarnMsg('Camera chưa sẵn sàng, thử lại sau giây lát');
      return;
    }
    setWarnMsg(null);

    // Rotate 90° CCW cho DroidCam landscape
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    canvas.width = rotate90 ? vh : vw;
    canvas.height = rotate90 ? vw : vh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (rotate90) {
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(video, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0);
    }

    // Check brightness RAW trước enhance — ảnh tối om → reject ngay, không gọi OCR
    // (Tesseract vẫn trả noise text trên ảnh tối nếu không chặn trước)
    const avgLum = computeAverageBrightness(canvas);
    if (avgLum < 80) {
      setWarnMsg(`Ảnh quá tối (độ sáng ${Math.round(avgLum)}/255). Vui lòng bật đèn hoặc giơ giấy nơi sáng hơn.`);
      return;
    }
    // Cũng check độ sáng quá cao (over-exposed, white-out) — ít gặp nhưng safe
    if (avgLum > 240) {
      setWarnMsg('Ảnh quá sáng / cháy sáng. Điều chỉnh lại góc camera.');
      return;
    }

    setMode('processing');

    // Enhance style CamScanner
    enhanceDocument(canvas);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('toBlob null'))),
          'image/jpeg',
          0.85,
        );
      });

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const fd = new FormData();
      fd.append('image', blob, 'scan.jpg');
      fd.append('procedureCode', procedureRef.current);

      const res = await fetch(`${SERVER_URL}/scan/classify`, {
        method: 'POST',
        body: fd,
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ClassifyResult = await res.json();

      // Verify có phải giấy tờ — OCR phải đọc được text THẬT (loại noise)
      const ocrText = data.ocrText ?? '';
      const textLen = ocrText.trim().length;
      // Đếm từ "thật" (>=3 ký tự chữ liên tiếp, có cả Vietnamese)
      const realWords = (ocrText.match(/[\p{L}]{3,}/gu) ?? []).length;
      const looksLikeDocument =
        data.ocrConfidence >= 55
        || (textLen >= 40 && realWords >= 5);

      if (!looksLikeDocument) {
        setWarnMsg(
          `Không đọc được văn bản rõ ràng (OCR ${data.ocrConfidence.toFixed(0)}%, ${realWords} từ). Vui lòng giơ giấy tờ rõ hơn.`,
        );
        setMode('ready');
        return;
      }

      setCapturedImg(dataUrl);
      setLastResult(data);
      setMode('matched');
      setShowResultModal(true);
      triggerAnim();
    } catch (err) {
      const msg = (err as Error).message;
      if ((err as Error).name !== 'AbortError') {
        setWarnMsg(`Lỗi nhận dạng: ${msg}`);
      }
      setMode('ready');
    }
  }, [rotate90, triggerAnim]);

  const handleRetake = useCallback(() => {
    setShowResultModal(false);
    setCapturedImg(null);
    setLastResult(null);
    setMode('ready');
  }, []);

  const handleKeep = useCallback(() => {
    if (!capturedImg) return;
    onKeep(capturedImg, lastResult?.match ?? null, lastResult?.ocrText ?? '');
    setShowResultModal(false);
    setCapturedImg(null);
    setLastResult(null);
    setMode('ready');
  }, [capturedImg, lastResult, onKeep]);

  const captureDisabled = mode !== 'ready';
  const captureLabel = mode === 'processing' ? 'Đang nhận dạng...' : 'Chụp tài liệu';

  return (
    <div className="auto-scan-root">
      {error && <div className="auto-scan-error">❌ {error}</div>}

      <div className={`auto-scan-stage${rotate90 ? ' is-rotated' : ''}`}>
        <video ref={videoRef} className="auto-scan-video" muted playsInline />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {warnMsg && (
        <div className="auto-scan-warn">⚠️ {warnMsg}</div>
      )}

      <button
        type="button"
        className="auto-scan-capture-btn"
        onClick={handleCapture}
        disabled={captureDisabled}
      >
        {captureLabel}
      </button>

      {/* Modal kết quả — scope vào .kiosk-content-panel */}
      <Modal
        open={showResultModal && !!capturedImg}
        overlayClassName="auto-scan-result-overlay"
        visibleClassName="auto-scan-result-overlay--visible"
        portalSelector=".kiosk-content-panel"
        onClose={handleRetake}
      >
        {capturedImg && (
          <div
            className="auto-scan-result-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="auto-scan-result-header">
              <h2>
                <span>✅</span>
                <span>
                  {lastResult?.match
                    ? `Đã nhận diện: ${lastResult.match.name}`
                    : 'Đã chụp ảnh'}
                </span>
              </h2>
            </div>

            <div className="auto-scan-result-body">
              <div className={`auto-scan-trail${scanAnim ? ' is-active' : ''}`} />
              <div className={`auto-scan-line${scanAnim ? ' is-active' : ''}`} />
              <img
                src={capturedImg}
                alt="Ảnh đã scan"
                className={`auto-scan-result-img${scanAnim ? ' is-reveal' : ''}`}
              />
            </div>

            <div className="auto-scan-result-footer">
              <button
                type="button"
                className="auto-scan-result-btn auto-scan-result-btn--retake"
                onClick={handleRetake}
              >
                🔄 Chụp lại
              </button>
              <button
                type="button"
                className="auto-scan-result-btn auto-scan-result-btn--keep"
                onClick={handleKeep}
              >
                ✓ Giữ ảnh
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/**
 * Trung bình luminance của canvas (downscale 32x32 cho nhanh).
 * 0 = đen tuyền, 255 = trắng tinh. Dùng để phát hiện ảnh quá tối trước OCR.
 */
function computeAverageBrightness(canvas: HTMLCanvasElement): number {
  const SIZE = 32;
  const tmp = document.createElement('canvas');
  tmp.width = SIZE;
  tmp.height = SIZE;
  const tctx = tmp.getContext('2d');
  if (!tctx) return 0;
  tctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, SIZE, SIZE);
  const { data } = tctx.getImageData(0, 0, SIZE, SIZE);
  let sum = 0;
  for (let i = 0; i < SIZE * SIZE; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    sum += 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return sum / (SIZE * SIZE);
}

/**
 * Enhance document style CamScanner:
 *  1. Auto-levels: histogram stretch 3%-97% → giấy xám thành trắng, chữ mờ thành đen
 *  2. Gamma 0.88: brighten midtones nhẹ
 *  3. Contrast boost nhẹ (v-0.5)*1.15+0.5 → S-curve nhẹ
 *  4. Desaturate 20%: bớt ám màu camera
 *  5. Unsharp mask 3x3 strength 0.4: chữ nổi rõ hơn
 *
 * In-place canvas → OCR cũng dùng ảnh enhance → match chính xác hơn.
 * Performance ~100-200ms @ 1080p.
 */
function enhanceDocument(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const total = w * h;

  // Bước 1: Histogram → percentiles 3%-97%
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    hist[lum]++;
  }

  const cut = total * 0.03;
  let blackPoint = 0;
  let whitePoint = 255;
  let cum = 0;
  for (let i = 0; i < 256; i++) {
    cum += hist[i];
    if (cum >= cut) { blackPoint = i; break; }
  }
  cum = 0;
  for (let i = 255; i >= 0; i--) {
    cum += hist[i];
    if (cum >= cut) { whitePoint = i; break; }
  }
  if (whitePoint - blackPoint < 40) {
    blackPoint = 30;
    whitePoint = 225;
  }

  // Bước 2: LUT auto-levels gentle — output range [10, 245] tránh cháy sáng tuyệt đối
  const range = whitePoint - blackPoint;
  const gamma = 0.95;
  const OUT_MIN = 10;
  const OUT_MAX = 245;
  const OUT_RANGE = OUT_MAX - OUT_MIN;
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    let v = (i - blackPoint) / range;
    if (v < 0) v = 0;
    else if (v > 1) v = 1;
    v = Math.pow(v, gamma);
    lut[i] = Math.round(OUT_MIN + v * OUT_RANGE);
  }

  // Bước 3: Apply LUT + desaturate 12%
  for (let i = 0; i < d.length; i += 4) {
    const r = lut[d[i]];
    const g = lut[d[i + 1]];
    const b = lut[d[i + 2]];
    const gray = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
    d[i] = Math.round(r * 0.88 + gray * 0.12);
    d[i + 1] = Math.round(g * 0.88 + gray * 0.12);
    d[i + 2] = Math.round(b * 0.88 + gray * 0.12);
  }

  ctx.putImageData(img, 0, 0);
  // Bỏ unsharp — gây halo trắng quanh chữ, cảm giác cháy
}

/**
 * Unsharp mask 3x3 — kernel `[0,-1,0; -1,5+s,-1; 0,-1,0]`.
 * Làm edges của chữ rõ hơn. Strength 0.4 = nhẹ (không tạo nhiễu).
 */
function applyUnsharpMask(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  strength: number,
): void {
  const src = ctx.getImageData(0, 0, w, h);
  const dst = ctx.createImageData(w, h);
  const s = src.data;
  const out = dst.data;
  const centerWeight = 5 + strength;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const iC = (y * w + x) * 4;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        out[iC] = s[iC];
        out[iC + 1] = s[iC + 1];
        out[iC + 2] = s[iC + 2];
        out[iC + 3] = 255;
        continue;
      }
      const iU = ((y - 1) * w + x) * 4;
      const iD = ((y + 1) * w + x) * 4;
      const iL = (y * w + (x - 1)) * 4;
      const iR = (y * w + (x + 1)) * 4;

      for (let c = 0; c < 3; c++) {
        const v = s[iC + c] * centerWeight
                - s[iU + c] - s[iD + c] - s[iL + c] - s[iR + c];
        out[iC + c] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
      out[iC + 3] = 255;
    }
  }
  ctx.putImageData(dst, 0, 0);
}
