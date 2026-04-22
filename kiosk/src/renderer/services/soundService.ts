/**
 * Sound service cho kiosk — sinh tone programmatic bằng Web Audio API,
 * không cần file audio → không tăng bundle, hoạt động offline.
 *
 * Thiết kế cho màn hình cảm ứng: user không có cảm giác vật lý khi bấm
 * nút, sound là proxy tactile feedback + ăn mừng moment quan trọng.
 *
 * Mute state lưu localStorage để persist qua session.
 * Volume thấp (0.12) để không ầm ĩ trong môi trường công cộng.
 */

const MUTE_STORAGE_KEY = 'kiosk.muted';
const VOLUME = 0.12;

type SoundKind = 'tick' | 'success' | 'error';
/** Loại tone theo action — dùng trong global click listener để phân biệt
 * primary/secondary/destructive bằng pitch + màu âm. */
export type SoundActionType = 'primary' | 'secondary' | 'destructive' | 'default';

let audioCtx: AudioContext | null = null;
let isMuted = false;
// Subscribers để UI (nút mute trong header) re-render khi mute state đổi.
const mutedListeners = new Set<(muted: boolean) => void>();

function loadInitialMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

isMuted = loadInitialMuted();

function getContext(): AudioContext {
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new Ctor();
  }
  // Chrome autoplay policy: context có thể ở trạng thái 'suspended' cho đến khi
  // có user gesture. Resume ở mỗi lần play để an toàn.
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {
      /* silent — UX không vỡ nếu không resume được */
    });
  }
  return audioCtx;
}

interface ToneOpts {
  freqEnd?: number;
  type?: OscillatorType;
  gainMul?: number;
  /** Delay tính từ now. Dùng để xếp layer/arpeggio. */
  startDelayMs?: number;
  /** Attack/release envelope. Mặc định 8ms/durationMs. */
  attackMs?: number;
  /** Exponential decay cho âm "pluck" tự nhiên hơn linear. */
  exponentialDecay?: boolean;
}

/**
 * ADSR đơn giản — attack nhanh chống click + exponential decay cho âm
 * ấm tự nhiên (giống instrument thật hơn linear ramp).
 */
function playTone(ctx: AudioContext, frequency: number, durationMs: number, opts?: ToneOpts) {
  const start = ctx.currentTime + (opts?.startDelayMs ?? 0) / 1000;
  const duration = durationMs / 1000;
  const attack = (opts?.attackMs ?? 8) / 1000;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = opts?.type ?? 'sine';
  osc.frequency.setValueAtTime(frequency, start);
  if (opts?.freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqEnd), start + duration);
  }

  const peakGain = VOLUME * (opts?.gainMul ?? 1);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peakGain, start + attack);

  if (opts?.exponentialDecay) {
    // Exponential release → âm "pluck" như phím đàn.
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  } else {
    gain.gain.linearRampToValueAtTime(0, start + duration);
  }

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** Tick — soft pop như trackpad MacBook, pitch drop nhẹ 2000→1200Hz. */
function playTick(ctx: AudioContext) {
  playTone(ctx, 2000, 35, {
    freqEnd: 1200,
    type: 'sine',
    gainMul: 0.8,
    attackMs: 2,
    exponentialDecay: true,
  });
}

/**
 * Tone riêng cho từng loại action — user phân biệt được "đang bấm gì"
 * qua tai, hỗ trợ accessibility.
 *  - primary   : pitch cao (xác nhận, submit, next)
 *  - secondary : pitch trầm ấm (back, cancel)
 *  - destructive: pitch drop mạnh (logout, delete — cảnh báo)
 */
function playActionTone(ctx: AudioContext, type: SoundActionType) {
  switch (type) {
    case 'primary':
      playTone(ctx, 2400, 45, {
        freqEnd: 1600,
        type: 'triangle',
        gainMul: 0.9,
        attackMs: 2,
        exponentialDecay: true,
      });
      break;
    case 'secondary':
      playTone(ctx, 1200, 50, {
        freqEnd: 900,
        type: 'sine',
        gainMul: 0.75,
        attackMs: 2,
        exponentialDecay: true,
      });
      break;
    case 'destructive':
      playTone(ctx, 800, 90, {
        freqEnd: 400,
        type: 'triangle',
        gainMul: 1.0,
        attackMs: 2,
        exponentialDecay: true,
      });
      break;
    default:
      playTick(ctx);
  }
}

/**
 * Star rating tone — tần số tăng dần theo sao (C5→D5→E5→F5→G5 pentatonic).
 * Cảm giác "đánh giá cao dần" bằng tai.
 */
function playStar(ctx: AudioContext, level: number) {
  const notes = [523.25, 587.33, 659.25, 698.46, 783.99]; // C5 D5 E5 F5 G5
  const freq = notes[Math.max(0, Math.min(4, level - 1))];
  playTone(ctx, freq, 160, {
    type: 'triangle',
    gainMul: 1.1,
    attackMs: 4,
    exponentialDecay: true,
  });
}

/**
 * Success — arpeggio C5-E5-G5 (chord C trưởng) như iOS/Apple Pay notification.
 * Triangle wave cho âm sáng nhưng không gắt, 3 nốt liên tiếp tạo cảm giác
 * "hoàn thành có giai điệu".
 */
function playSuccess(ctx: AudioContext) {
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  notes.forEach((freq, i) => {
    playTone(ctx, freq, 180, {
      type: 'triangle',
      gainMul: 1.2,
      startDelayMs: i * 70,
      attackMs: 10,
      exponentialDecay: true,
    });
  });
  // Nốt C6 cuối (octave) cho cảm giác "landing" — mạnh hơn chút.
  playTone(ctx, 1046.5, 260, {
    type: 'triangle',
    gainMul: 1.5,
    startDelayMs: 210,
    attackMs: 10,
    exponentialDecay: true,
  });
}

/**
 * Error — 2 nốt descending minor third (F4 → D4) như âm "nope" nhẹ.
 * Sine wave giữ mềm, không harsh như sawtooth.
 */
function playError(ctx: AudioContext) {
  playTone(ctx, 349.23, 150, {
    type: 'sine',
    gainMul: 1.1,
    attackMs: 8,
    exponentialDecay: true,
  });
  playTone(ctx, 293.66, 220, {
    type: 'sine',
    gainMul: 1.1,
    startDelayMs: 140,
    attackMs: 8,
    exponentialDecay: true,
  });
}

function playKind(kind: SoundKind) {
  if (isMuted) return;
  try {
    const ctx = getContext();
    switch (kind) {
      case 'tick':
        playTick(ctx);
        break;
      case 'success':
        playSuccess(ctx);
        break;
      case 'error':
        playError(ctx);
        break;
    }
  } catch {
    /* silent fail — sound không phải critical */
  }
}

/** Whoosh — sweep pitch 1500→400Hz sawtooth 300ms, dùng khi scan beam start. */
function playWhoosh(ctx: AudioContext) {
  playTone(ctx, 1500, 300, {
    freqEnd: 400,
    type: 'sawtooth',
    gainMul: 0.65,
    attackMs: 5,
    exponentialDecay: true,
  });
}

/** Modal open pop — 1000Hz sine, 60ms, nhẹ như "air release". */
function playModalOpen(ctx: AudioContext) {
  playTone(ctx, 1000, 60, {
    type: 'sine',
    gainMul: 0.7,
    attackMs: 2,
    exponentialDecay: true,
  });
}

/** Modal close swoosh — sweep 800→300Hz 150ms, cảm giác "vanish". */
function playModalClose(ctx: AudioContext) {
  playTone(ctx, 800, 150, {
    freqEnd: 300,
    type: 'sine',
    gainMul: 0.6,
    attackMs: 3,
    exponentialDecay: true,
  });
}

/** Step forward — 2 nốt ascending G5→C6, cảm giác "tiến lên". */
function playStepForward(ctx: AudioContext) {
  playTone(ctx, 784, 90, { type: 'triangle', gainMul: 0.9, exponentialDecay: true });
  playTone(ctx, 1046.5, 130, {
    type: 'triangle',
    gainMul: 1.0,
    startDelayMs: 80,
    exponentialDecay: true,
  });
}

/** Step back — 2 nốt descending C6→G5, cảm giác "lùi lại". */
function playStepBack(ctx: AudioContext) {
  playTone(ctx, 1046.5, 90, { type: 'triangle', gainMul: 0.9, exponentialDecay: true });
  playTone(ctx, 784, 130, {
    type: 'triangle',
    gainMul: 1.0,
    startDelayMs: 80,
    exponentialDecay: true,
  });
}

/** Pip — tick ngắn 1800Hz × 25ms cho OCR field extract, nghe "máy quét đọc". */
function playPip(ctx: AudioContext) {
  playTone(ctx, 1800, 25, {
    type: 'square',
    gainMul: 0.5,
    attackMs: 1,
    exponentialDecay: true,
  });
}

export const sound = {
  tick: () => playKind('tick'),
  success: () => playKind('success'),
  error: () => playKind('error'),
  /** Phát tone theo loại action — dùng trong global click để phân biệt. */
  action: (type: SoundActionType) => {
    if (isMuted) return;
    try {
      playActionTone(getContext(), type);
    } catch {
      /* ignore */
    }
  },
  /** Phát tone tăng dần theo sao (1..5). */
  star: (level: number) => {
    if (isMuted) return;
    try {
      playStar(getContext(), level);
    } catch {
      /* ignore */
    }
  },
  /** Scan beam whoosh — OCR scan bắt đầu. */
  whoosh: () => {
    if (isMuted) return;
    try {
      playWhoosh(getContext());
    } catch {
      /* ignore */
    }
  },
  /** Modal mở — pop air release. */
  modalOpen: () => {
    if (isMuted) return;
    try {
      playModalOpen(getContext());
    } catch {
      /* ignore */
    }
  },
  /** Modal đóng — swoosh vanish. */
  modalClose: () => {
    if (isMuted) return;
    try {
      playModalClose(getContext());
    } catch {
      /* ignore */
    }
  },
  /** Stepper tiến lên bước mới — 2 tone ascending. */
  stepForward: () => {
    if (isMuted) return;
    try {
      playStepForward(getContext());
    } catch {
      /* ignore */
    }
  },
  /** Stepper lùi về bước cũ — 2 tone descending. */
  stepBack: () => {
    if (isMuted) return;
    try {
      playStepBack(getContext());
    } catch {
      /* ignore */
    }
  },
  /** Pip ngắn — OCR field extracted, máy scan đọc. */
  pip: () => {
    if (isMuted) return;
    try {
      playPip(getContext());
    } catch {
      /* ignore */
    }
  },
};

export function isSoundMuted(): boolean {
  return isMuted;
}

export function setSoundMuted(muted: boolean): void {
  isMuted = muted;
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
  } catch {
    /* storage có thể fail trong private mode — ignore */
  }
  mutedListeners.forEach((fn) => fn(muted));
}

export function toggleSoundMuted(): void {
  setSoundMuted(!isMuted);
}

/** Subscribe đến thay đổi mute state. Trả về unsubscribe fn. */
export function subscribeSoundMuted(listener: (muted: boolean) => void): () => void {
  mutedListeners.add(listener);
  return () => {
    mutedListeners.delete(listener);
  };
}
