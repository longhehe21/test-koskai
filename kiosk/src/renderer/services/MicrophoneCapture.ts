const MIME_TYPE = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
  ? 'audio/webm;codecs=opus'
  : 'audio/webm';

const MAX_RECORDING_MS   = 30_000;
const CHUNK_INTERVAL_MS  = 250;

/** RMS dưới ngưỡng này được coi là im lặng */
const SILENCE_THRESHOLD  = 0.008;
/**
 * Phải im lặng liên tục bao lâu (ms) để trigger onSilenceDetected.
 * 2s: đủ để user ngắt nghỉ giữa câu mà không bị cắt sớm.
 */
const SILENCE_DURATION_MS = 2_000;
/**
 * Thời gian tối thiểu ghi âm trước khi silence detection được kích hoạt.
 * 2s: đủ để mic warm-up và user bắt đầu nói.
 */
const MIN_RECORD_MS = 2_000;

export class MicrophoneCapture {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private recording = false;
  private maxTimer: ReturnType<typeof setTimeout> | null = null;
  private stopResolve: ((transcript: string) => void) | null = null;
  private stopReject: ((err: Error) => void) | null = null;

  // VAD
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private vadRaf: number | null = null;
  private silenceStart: number | null = null;
  private onSilenceDetected: (() => void) | null = null;

  get isRecording(): boolean {
    return this.recording;
  }

  /**
   * Bắt đầu ghi âm.
   * @param onSilence Callback khi phát hiện im lặng đủ lâu sau khi có tiếng nói.
   *                  Nếu truyền vào, VAD tự động kích hoạt.
   */
  async start(onSilence?: () => void): Promise<void> {
    if (this.recording) return;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, sampleRate: 48000 },
    });
    this.recorder = new MediaRecorder(this.stream, { mimeType: MIME_TYPE });

    await window.electronAPI.invoke('stt:start');

    this.recorder.ondataavailable = async (event) => {
      if (event.data.size === 0) return;
      const audio = new Uint8Array(await event.data.arrayBuffer());
      await window.electronAPI.invoke('stt:chunk', { audio });
    };

    this.recorder.onstop = async () => {
      try {
        const transcript = (await window.electronAPI.invoke('stt:stop')) as string;
        this.stopResolve?.(transcript);
      } catch (err) {
        this.stopReject?.(err instanceof Error ? err : new Error(String(err)));
      } finally {
        this.stopResolve = null;
        this.stopReject = null;
        this.releaseStream();
      }
    };

    this.recorder.start(CHUNK_INTERVAL_MS);
    this.recording = true;

    this.maxTimer = setTimeout(() => void this.stop(), MAX_RECORDING_MS);

    if (onSilence) {
      this.onSilenceDetected = onSilence;
      this.startVAD();
    }
  }

  stop(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.stopVAD();

      if (!this.recording || !this.recorder) {
        resolve('');
        return;
      }

      this.stopResolve = resolve;
      this.stopReject = reject;
      this.recording = false;

      if (this.maxTimer) {
        clearTimeout(this.maxTimer);
        this.maxTimer = null;
      }

      this.recorder.stop();
    });
  }

  dispose(): void {
    this.stopVAD();
    if (this.maxTimer) clearTimeout(this.maxTimer);
    if (this.recording) {
      this.recording = false;
      this.recorder?.stop();
    }
    this.releaseStream();
  }

  private startVAD(): void {
    if (!this.stream) return;

    this.silenceStart = null;
    const startTime = performance.now();

    this.audioCtx = new AudioContext({ sampleRate: 48000 });
    void this.audioCtx.resume();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 512;

    const source = this.audioCtx.createMediaStreamSource(this.stream);
    source.connect(this.analyser);

    const buffer = new Float32Array(this.analyser.fftSize);
    // firstSampleAt: thời điểm nhận được sample thực đầu tiên (khác 0).
    // Dùng thay cho startTime để tránh mic warm-up (~400ms) ăn vào MIN_RECORD_MS.
    let firstSampleAt: number | null = null;

    const tick = () => {
      if (!this.analyser || !this.recording) return;

      this.analyser.getFloatTimeDomainData(buffer);

      let sumSq = 0;
      for (let i = 0; i < buffer.length; i++) sumSq += buffer[i] * buffer[i];
      const rms = Math.sqrt(sumSq / buffer.length);

      // Detect khi mic bắt đầu gửi sample thực (không phải silence từ warm-up)
      if (firstSampleAt === null && rms > 0.0001) {
        firstSampleAt = performance.now();
      }

      const elapsed = firstSampleAt !== null
        ? performance.now() - firstSampleAt
        : performance.now() - startTime;

      if (elapsed < MIN_RECORD_MS) {
        // Chờ tối thiểu trước khi bắt đầu detect silence
        this.vadRaf = requestAnimationFrame(tick);
        return;
      }

      if (rms >= SILENCE_THRESHOLD) {
        // Có tiếng — reset silence timer
        this.silenceStart = null;
      } else {
        // Im lặng
        if (this.silenceStart === null) {
          this.silenceStart = performance.now();
        } else if (performance.now() - this.silenceStart >= SILENCE_DURATION_MS) {
          const cb = this.onSilenceDetected;
          this.stopVAD();
          cb?.();
          return;
        }
      }

      this.vadRaf = requestAnimationFrame(tick);
    };

    this.vadRaf = requestAnimationFrame(tick);
  }

  private stopVAD(): void {
    this.onSilenceDetected = null;
    if (this.vadRaf !== null) {
      cancelAnimationFrame(this.vadRaf);
      this.vadRaf = null;
    }
    this.audioCtx?.close().catch(() => undefined);
    this.audioCtx = null;
    this.analyser = null;
    this.silenceStart = null;
  }

  private releaseStream(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
  }
}
