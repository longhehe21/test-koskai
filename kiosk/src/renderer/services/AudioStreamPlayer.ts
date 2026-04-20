const FFT_SIZE = 256;

export class AudioStreamPlayer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private readonly connectedElements = new WeakSet<HTMLAudioElement>();
  private readonly timeDomainBuffer: Uint8Array;
  private readonly frequencyBuffer: Uint8Array;

  constructor() {
    this.timeDomainBuffer = new Uint8Array(FFT_SIZE);
    this.frequencyBuffer = new Uint8Array(FFT_SIZE / 2);
  }

  connectElement(audio: HTMLAudioElement): void {
    if (this.connectedElements.has(audio)) return;

    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = FFT_SIZE;
      this.analyser.smoothingTimeConstant = 0.65;
      this.analyser.connect(this.audioContext.destination);
    }

    this.source = this.audioContext.createMediaElementSource(audio);
    this.source.connect(this.analyser!);
    this.connectedElements.add(audio);

    void this.audioContext.resume();
  }

  getAmplitude(): number {
    if (!this.analyser) return 0;

    this.analyser.getByteTimeDomainData(this.timeDomainBuffer);

    let sumSquares = 0;
    for (let i = 0; i < this.timeDomainBuffer.length; i++) {
      const normalized = (this.timeDomainBuffer[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }

    return Math.sqrt(sumSquares / this.timeDomainBuffer.length);
  }

  getFrequencyData(): Uint8Array {
    if (!this.analyser) return this.frequencyBuffer;

    this.analyser.getByteFrequencyData(this.frequencyBuffer);
    return this.frequencyBuffer;
  }

  get isPlaying(): boolean {
    if (!this.analyser) return false;
    return this.getAmplitude() > 0.01;
  }

  dispose(): void {
    this.source?.disconnect();
    this.analyser?.disconnect();
    void this.audioContext?.close();
    this.source = null;
    this.analyser = null;
    this.audioContext = null;
  }
}
