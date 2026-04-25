const MIME_TYPE = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
  ? 'audio/webm;codecs=opus'
  : 'audio/webm';

const MAX_RECORDING_MS   = 30_000;
const CHUNK_INTERVAL_MS  = 250;

/** RMS dưới ngưỡng này được coi là im lặng */
const SILENCE_THRESHOLD  = 0.008;
/** Phải im lặng liên tục bao lâu (ms) để trigger onSilenceDetected — chỉ sau khi đã có speech. */
const SILENCE_DURATION_MS = 2_000;
/** Thời gian tối thiểu ghi âm trước khi silence detection được kích hoạt. */
const MIN_RECORD_MS = 2_000;
/** RMS phải vượt SILENCE_THRESHOLD liên tục bao lâu để xác nhận "có tiếng nói thật". */
const SPEECH_MIN_MS = 100;
/** Cho phép brief dip (ms) dưới threshold mà không reset speech detection — tránh miss short words. */
const SPEECH_DIP_TOLERANCE_MS = 80;
/** Nếu sau bao lâu vẫn chưa phát hiện tiếng nói → gọi onNoSpeech (restart im lặng). */
const NO_SPEECH_TIMEOUT_MS = 8_000;

/** RMS vượt ngưỡng này trong SPEAKING → trigger barge-in */
const BARGE_IN_THRESHOLD = 0.025;
/** Phải có voice liên tục bao lâu (ms) để xác nhận barge-in (tránh click/noise) */
const BARGE_IN_CONFIRM_MS = 180;

export class MicrophoneCapture {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private recording = false;
  private maxTimer: ReturnType<typeof setTimeout> | null = null;
  private stopResolve: ((transcript: string) => void) | null = null;
  private stopReject: ((err: Error) => void) | null = null;

  // VAD (recording mode)
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private vadRaf: number | null = null;
  private silenceStart: number | null = null;
  private onSilenceDetected: (() => void) | null = null;
  private onNoSpeechCallback: (() => void) | null = null;

  // Barge-in monitor (non-recording, listening-only)
  private bargeInStream: MediaStream | null = null;
  private bargeInCtx: AudioContext | null = null;
  private bargeInRaf: number | null = null;
  private bargeInVoiceStart: number | null = null;

  get isRecording(): boolean {
    return this.recording;
  }

  /** Bắt đầu monitor mic (không record) để phát hiện barge-in khi AI đang nói.
   *  @param onBargeIn callback khi phát hiện giọng nói đủ dài
   */
  async startBargeInMonitor(onBargeIn: () => void): Promise<void> {
    if (this.bargeInStream) return;
    try {
      this.bargeInStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 48000 },
      });
      this.bargeInCtx = new AudioContext({ sampleRate: 48000 });
      await this.bargeInCtx.resume();
      const analyser = this.bargeInCtx.createAnalyser();
      analyser.fftSize = 512;
      const source = this.bargeInCtx.createMediaStreamSource(this.bargeInStream);
      source.connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);
      this.bargeInVoiceStart = null;

      const tick = () => {
        if (!this.bargeInStream) return;
        analyser.getFloatTimeDomainData(buffer);
        let sumSq = 0;
        for (let i = 0; i < buffer.length; i++) sumSq += buffer[i] * buffer[i];
        const rms = Math.sqrt(sumSq / buffer.length);

        if (rms >= BARGE_IN_THRESHOLD) {
          if (this.bargeInVoiceStart === null) this.bargeInVoiceStart = performance.now();
          else if (performance.now() - this.bargeInVoiceStart >= BARGE_IN_CONFIRM_MS) {
            this.stopBargeInMonitor();
            onBargeIn();
            return;
          }
        } else {
          this.bargeInVoiceStart = null;
        }
        this.bargeInRaf = requestAnimationFrame(tick);
      };
      this.bargeInRaf = requestAnimationFrame(tick);
    } catch {
      // Barge-in là tính năng optional — không crash nếu mic không cho phép
    }
  }

  stopBargeInMonitor(): void {
    if (this.bargeInRaf !== null) {
      cancelAnimationFrame(this.bargeInRaf);
      this.bargeInRaf = null;
    }
    this.bargeInCtx?.close().catch(() => undefined);
    this.bargeInCtx = null;
    this.bargeInStream?.getTracks().forEach((t) => t.stop());
    this.bargeInStream = null;
    this.bargeInVoiceStart = null;
  }

  /**
   * Bắt đầu ghi âm.
   * @param onSilence Callback khi phát hiện im lặng đủ lâu sau khi có tiếng nói.
   *                  Nếu truyền vào, VAD tự động kích hoạt.
   */
  async start(onSilence?: () => void, onNoSpeech?: () => void): Promise<void> {
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
      this.onNoSpeechCallback = onNoSpeech ?? null;
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
    this.stopBargeInMonitor();
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
    // speechDetected: chỉ bắt đầu đếm silence sau khi xác nhận có tiếng nói thật.
    let speechDetected = false;
    let speechStart: number | null = null;
    let dipStart: number | null = null; // brief dip tolerance — không reset ngay khi 1 frame lặng

    const tick = () => {
      if (!this.analyser || !this.recording) return;

      this.analyser.getFloatTimeDomainData(buffer);

      let sumSq = 0;
      for (let i = 0; i < buffer.length; i++) sumSq += buffer[i] * buffer[i];
      const rms = Math.sqrt(sumSq / buffer.length);

      if (firstSampleAt === null && rms > 0.0001) {
        firstSampleAt = performance.now();
      }

      const elapsed = firstSampleAt !== null
        ? performance.now() - firstSampleAt
        : performance.now() - startTime;

      if (elapsed < MIN_RECORD_MS) {
        this.vadRaf = requestAnimationFrame(tick);
        return;
      }

      if (rms >= SILENCE_THRESHOLD) {
        dipStart = null; // voice resumed — reset dip timer
        if (!speechDetected) {
          if (speechStart === null) speechStart = performance.now();
          else if (performance.now() - speechStart >= SPEECH_MIN_MS) speechDetected = true;
        }
        this.silenceStart = null;
      } else {
        // Brief dip: chỉ reset speechStart sau SPEECH_DIP_TOLERANCE_MS liên tục lặng
        if (!speechDetected) {
          if (dipStart === null) dipStart = performance.now();
          else if (performance.now() - dipStart >= SPEECH_DIP_TOLERANCE_MS) {
            speechStart = null; // dip đủ lâu → reset
            dipStart = null;
          }
        } else {
          dipStart = null; // speech đã confirmed, không cần dip tolerance nữa
        }

        if (!speechDetected) {
          // Chưa nghe thấy tiếng nói — kiểm tra no-speech timeout
          if (elapsed >= NO_SPEECH_TIMEOUT_MS) {
            const cb = this.onNoSpeechCallback;
            this.stopVAD();
            cb?.();
            return;
          }
        } else {
          // Đã có speech, giờ đếm silence
          if (this.silenceStart === null) {
            this.silenceStart = performance.now();
          } else if (performance.now() - this.silenceStart >= SILENCE_DURATION_MS) {
            const cb = this.onSilenceDetected;
            this.stopVAD();
            cb?.();
            return;
          }
        }
      }

      this.vadRaf = requestAnimationFrame(tick);
    };

    this.vadRaf = requestAnimationFrame(tick);
  }

  private stopVAD(): void {
    this.onSilenceDetected = null;
    this.onNoSpeechCallback = null;
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
