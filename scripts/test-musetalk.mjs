/**
 * test-musetalk.mjs — Script kiểm tra protocol MuseTalk WebSocket thực tế.
 *
 * Chạy: node scripts/test-musetalk.mjs
 *
 * Script sẽ:
 *  1. Kết nối tới MuseTalk server
 *  2. Gửi init config
 *  3. Gửi WAV 16kHz sample (1 giây silence)
 *  4. Log mọi message nhận được (type, size, timing)
 *  5. Lưu frame JPEG đầu tiên vào scripts/first-frame.jpg (nếu nhận được)
 *
 * FILE NÀY CHỈ DÙNG ĐỂ DEBUG — KHÔNG COMMIT VÀO REPO.
 */

// Node.js 21+ có WebSocket built-in — không cần package 'ws'
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WS_URL = process.env.MUSETALK_URL ?? 'ws://34.87.53.240:8000/avatar';
const TIMEOUT_MS = 15_000;

// ── Audio builders ─────────────────────────────────────────────────────────────
function buildSineWav(durationSeconds = 2, sampleRate = 16_000, freq = 440) {
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const pcmLength = numSamples * 2;
  const buf = Buffer.alloc(44 + pcmLength, 0);
  buf.write('RIFF', 0, 'ascii'); buf.writeUInt32LE(36 + pcmLength, 4); buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii'); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii'); buf.writeUInt32LE(pcmLength, 40);
  for (let i = 0; i < numSamples; i++) {
    buf.writeInt16LE(Math.round(0.5 * 32767 * Math.sin(2 * Math.PI * freq * i / sampleRate)), 44 + i * 2);
  }
  return buf;
}

/** Raw float32 mono PCM — format PyTorch/numpy expect khi load trực tiếp */
function buildFloat32Pcm(durationSeconds = 2, sampleRate = 16_000) {
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const buf = Buffer.alloc(numSamples * 4);
  for (let i = 0; i < numSamples; i++) {
    buf.writeFloatLE(0.5 * Math.sin(2 * Math.PI * 440 * i / sampleRate), i * 4);
  }
  return buf;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const startTime = Date.now();
const log = (msg) => console.log(`[${Date.now() - startTime}ms] ${msg}`);

log(`Kết nối tới: ${WS_URL}`);
// Node.js 21+ global WebSocket (Undici-based)
const ws = new WebSocket(WS_URL);
ws.binaryType = 'arraybuffer'; // nhận binary dưới dạng ArrayBuffer

let frameCount = 0;
let totalBytesReceived = 0;
let firstFrameSaved = false;
let chunkDoneReceived = false;

// Thử các init config khác nhau:
// process.env.INIT_MODE = 'no-path' | 'full' (default)
const initConfig = process.env.INIT_MODE === 'no-path'
  ? { avatar_id: 'default' }
  : { avatar_id: 'default', avatar_path: 'data/video/yongen.mp4' };

const SKIP_AUDIO = process.argv.includes('--init-only');
const MODE = process.argv.find(a => a.startsWith('--mode='))?.split('=')[1] ?? 'tts';
const TTS_API_KEY = process.env.GOOGLE_TTS_KEY ?? 'AIzaSyACicVSuP_FCrf_m8Craqb_rVfC6PaCKS8';

/** Gọi Google TTS để lấy WAV 16kHz thật (speech audio) */
async function fetchSpeechWav(text = 'Xin chào, tôi là trợ lý AI tại kiosk hành chính công.') {
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${TTS_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: 'vi-VN', name: 'vi-VN-Neural2-A' },
      audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 16000 },
    }),
  });
  if (!res.ok) throw new Error(`TTS error: ${await res.text()}`);
  const { audioContent } = await res.json();
  const pcm = Buffer.from(audioContent, 'base64');

  // Build WAV header
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii'); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii'); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(16000, 24); header.writeUInt32LE(32000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii'); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

ws.onopen = () => {
  log(`✅ Kết nối thành công`);
  log(`→ Gửi init config: ${JSON.stringify(initConfig)}`);
  ws.send(JSON.stringify(initConfig));

  if (SKIP_AUDIO) {
    log(`ℹ️  --init-only mode: không gửi audio, đợi 5s xem server phản hồi gì...`);
    return;
  }

  // Đợi 1s sau init rồi gửi audio
  const sendAudio = async () => {
    if (MODE === 'tts') {
      log(`→ [tts] Đang lấy speech WAV từ Google TTS...`);
      try {
        const wav = await fetchSpeechWav();
        log(`→ [tts] Gửi WAV TTS ${(wav.byteLength / 1024).toFixed(1)}KB`);
        fs.writeFileSync(path.join(__dirname, 'test-speech.wav'), wav);
        log(`   Đã lưu → scripts/test-speech.wav`);
        ws.send(wav);
      } catch (e) {
        log(`❌ TTS error: ${e.message} — fallback sang sine wave`);
        ws.send(buildSineWav(2));
      }
    } else if (MODE === 'float32') {
      const pcm = buildFloat32Pcm(2);
      log(`→ [float32] Raw float32 PCM 2s: ${pcm.byteLength} bytes`);
      ws.send(pcm);
    } else if (MODE === 'wav-short') {
      const wav = buildSineWav(0.1);
      log(`→ [wav-short] WAV 0.1s: ${wav.byteLength} bytes`);
      ws.send(wav);
    } else if (MODE === 'raw-pcm') {
      const pcm = buildSineWav(2).subarray(44);
      log(`→ [raw-pcm] Raw int16 2s: ${pcm.byteLength} bytes`);
      ws.send(pcm);
    } else {
      const wav = buildSineWav(2);
      log(`→ [wav] WAV Buffer 2s: ${wav.byteLength} bytes`);
      ws.send(wav);
    }
  };

  setTimeout(() => void sendAudio(), 1_000);
};

ws.onmessage = (event) => {
  const data = event.data;

  if (data instanceof ArrayBuffer) {
    const buf = Buffer.from(data);
    frameCount++;
    totalBytesReceived += buf.byteLength;

    // Kiểm tra magic bytes của JPEG: FF D8 FF
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    // Kiểm tra PNG: 89 50 4E 47
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;

    const fmt = isJpeg ? 'JPEG' : isPng ? 'PNG'
      : `UNKNOWN(0x${buf[0].toString(16).padStart(2,'0')} 0x${buf[1].toString(16).padStart(2,'0')})`;
    log(`📦 Frame #${frameCount}: ${buf.byteLength} bytes — format: ${fmt}`);

    // Lưu frame đầu tiên để inspect
    if (!firstFrameSaved && (isJpeg || isPng)) {
      const ext = isJpeg ? 'jpg' : 'png';
      const outPath = path.join(__dirname, `first-frame.${ext}`);
      fs.writeFileSync(outPath, buf);
      log(`💾 Lưu frame đầu tiên → ${outPath}`);
      firstFrameSaved = true;
    }
  } else if (data instanceof Blob) {
    // Node.js WebSocket có thể trả Blob — convert sang ArrayBuffer
    data.arrayBuffer().then((ab) => {
      const syntheticEvent = { data: ab };
      ws.onmessage(syntheticEvent);
    });
  } else {
    const text = typeof data === 'string' ? data : String(data);
    log(`📝 Text message: "${text}"`);

    if (text === 'CHUNK_DONE') {
      chunkDoneReceived = true;
      log(`✅ CHUNK_DONE nhận được. Tổng: ${frameCount} frames, ${totalBytesReceived} bytes`);
      summary();
    } else {
      // In ra để phát hiện JSON hay format khác
      try {
        const parsed = JSON.parse(text);
        log(`   → JSON parsed: ${JSON.stringify(parsed)}`);
      } catch {
        log(`   → Raw text (không phải JSON)`);
      }
    }
  }
};

ws.onerror = (event) => {
  // Không exit ngay — chờ onclose để lấy close code + reason
  log(`❌ WebSocket error event. type=${event.type} message=${event.message ?? '(empty)'}`);
};

ws.onclose = (event) => {
  log(`🔌 Kết nối đóng — code: ${event.code}, reason: "${event.reason}", wasClean: ${event.wasClean}`);
  if (!chunkDoneReceived) {
    log(`⚠️  Chưa nhận CHUNK_DONE — server đóng kết nối sớm (close code: ${event.code})`);
    log(`    Close codes: 1000=normal, 1001=going away, 1002=protocol error, 1003=unsupported data,`);
    log(`                 1006=abnormal close, 1007=invalid data, 1011=server error`);
    summary();
  }
  process.exit(event.code === 1000 ? 0 : 1);
};

function summary() {
  console.log('\n═══════════════ KẾT QUẢ ═══════════════');
  console.log(`Server URL       : ${WS_URL}`);
  console.log(`Init config      : ${JSON.stringify(initConfig)}`);
  console.log(`Frames nhận được : ${frameCount}`);
  console.log(`Total bytes      : ${totalBytesReceived}`);
  console.log(`CHUNK_DONE       : ${chunkDoneReceived}`);
  if (firstFrameSaved) {
    console.log(`Frame đầu tiên   : scripts/first-frame.jpg (hoặc .png)`);
  }
  console.log('════════════════════════════════════════\n');

  // Tự đóng sau khi có summary
  setTimeout(() => ws.close(), 500);
}

// Timeout safety
setTimeout(() => {
  log(`⏱️  Timeout ${TIMEOUT_MS}ms — dừng test`);
  summary();
  process.exit(0);
}, TIMEOUT_MS);
