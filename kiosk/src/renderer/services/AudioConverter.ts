/**
 * Chuyển MP3 (ArrayBuffer) → WAV PCM 16-bit mono 16000 Hz.
 *
 * Quy trình:
 *  1. AudioContext.decodeAudioData  → float32 PCM (sample rate gốc, ví dụ 24 kHz)
 *  2. OfflineAudioContext           → resample về TARGET_SAMPLE_RATE (16 kHz cho Whisper)
 *  3. Encode PCM 16-bit little-endian + gắn WAV header 44 byte
 *
 * Lưu ý:
 *  - mp3Buffer.slice(0) tránh ArrayBuffer bị detach sau decodeAudioData
 *  - Luôn close AudioContext sau khi dùng xong để giải phóng bộ nhớ
 */

const TARGET_SAMPLE_RATE = 16_000;

export async function mp3ToWav(mp3Buffer: ArrayBuffer): Promise<ArrayBuffer> {
  // Bước 1: Decode MP3 → float32 PCM ở sample rate gốc
  const decodeCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(mp3Buffer.slice(0));
  } finally {
    await decodeCtx.close();
  }

  // Bước 2: Resample về 16000 Hz (mono) bằng OfflineAudioContext
  const numOutputSamples = Math.ceil(decoded.duration * TARGET_SAMPLE_RATE);
  const offlineCtx = new OfflineAudioContext(1, numOutputSamples, TARGET_SAMPLE_RATE);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start(0);
  const resampled = await offlineCtx.startRendering();

  // Bước 3: Encode PCM 16-bit little-endian (lấy channel 0 — mono)
  const channelData = resampled.getChannelData(0);
  const numSamples = channelData.length;
  const pcmBuffer = new ArrayBuffer(numSamples * 2);
  const pcmView = new DataView(pcmBuffer);

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, channelData[i]));
    // float32 [-1, 1] → int16 [-32768, 32767]
    const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    pcmView.setInt16(i * 2, int16, /* littleEndian */ true);
  }

  // Bước 4: Build WAV header (44 bytes) + PCM data
  return buildWav(pcmBuffer, TARGET_SAMPLE_RATE);
}

function buildWav(pcmBuffer: ArrayBuffer, sampleRate: number): ArrayBuffer {
  const wavBuffer = new ArrayBuffer(44 + pcmBuffer.byteLength);
  const v = new DataView(wavBuffer);

  const write = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) v.setUint8(offset + i, str.charCodeAt(i));
  };

  write(0, 'RIFF');
  v.setUint32(4, 36 + pcmBuffer.byteLength, true);  // file size - 8
  write(8, 'WAVE');
  write(12, 'fmt ');
  v.setUint32(16, 16, true);          // fmt chunk size
  v.setUint16(20, 1, true);           // PCM = 1
  v.setUint16(22, 1, true);           // channels = 1 (mono)
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); // byte rate: sampleRate × channels × bitsPerSample/8
  v.setUint16(32, 2, true);           // block align: channels × bitsPerSample/8
  v.setUint16(34, 16, true);          // bits per sample
  write(36, 'data');
  v.setUint32(40, pcmBuffer.byteLength, true);

  new Uint8Array(wavBuffer).set(new Uint8Array(pcmBuffer), 44);

  return wavBuffer;
}
