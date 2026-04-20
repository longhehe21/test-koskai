/**
 * grab-idle-frame.mjs
 * 1. Gọi Google TTS → WAV 16kHz tiếng Việt
 * 2. Gửi WAV tới MuseTalk WebSocket
 * 3. Lấy frame JPEG đầu tiên → lưu kiosk/public/avatar-idle.jpg
 *
 * Chạy: node scripts/grab-idle-frame.mjs
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '../kiosk/public/avatar-idle.jpg');

const TTS_API_KEY = 'AIzaSyACicVSuP_FCrf_m8Craqb_rVfC6PaCKS8';
const WS_URL = 'ws://34.87.53.240:8000/avatar';
const INIT_CONFIG = { avatar_id: 'default', avatar_path: 'data/video/yongen.mp4' };

// --- Bước 1: Gọi Google TTS ---
async function fetchTtsWav(text) {
  console.log('[TTS] Đang tạo audio cho:', text);
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
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TTS error ${res.status}: ${body}`);
  }
  const { audioContent } = await res.json();
  const buf = Buffer.from(audioContent, 'base64');
  console.log(`[TTS] Nhận WAV ${buf.byteLength} bytes`);
  return buf;
}

// --- Bước 2: Kết nối MuseTalk + gửi WAV + lấy frame đầu tiên ---
async function grabFirstFrame(wavBuf) {
  console.log('[WS] Kết nối tới', WS_URL);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.binaryType = 'arraybuffer';
    let gotFrame = false;

    const fail = (msg) => {
      if (gotFrame) return;
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      try { ws.close(); } catch {}
      reject(new Error(msg));
    };

    const globalTimeout = setTimeout(() => fail('Timeout toàn cục 40s'), 40_000);

    ws.onopen = () => {
      console.log('[WS] Kết nối OK — gửi config...');
      ws.send(JSON.stringify(INIT_CONFIG));

      // Chờ server load model/avatar xong rồi gửi WAV (có thể mất vài giây)
      setTimeout(() => {
        if (gotFrame) return;
        if (ws.readyState !== WebSocket.OPEN) {
          console.warn('[WS] Connection đã đóng trước khi gửi WAV, readyState=', ws.readyState);
          return;
        }
        // Convert Buffer → ArrayBuffer (giống app Electron)
        const ab = wavBuf.buffer.slice(wavBuf.byteOffset, wavBuf.byteOffset + wavBuf.byteLength);
        console.log(`[WS] Gửi WAV ${ab.byteLength} bytes (ArrayBuffer)...`);
        ws.send(ab);
      }, 5000);
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        console.log('[WS] Text:', event.data);
        return;
      }
      if (gotFrame) return;
      gotFrame = true;
      clearTimeout(globalTimeout);
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      try { ws.close(); } catch {}
      const bytes = Buffer.from(new Uint8Array(event.data));
      console.log(`[WS] Nhận frame JPEG ${bytes.byteLength} bytes`);
      resolve(bytes);
    };

    ws.onerror = (ev) => {
      // Không fail ngay — server có thể gửi frames rồi mới error/close
      console.warn('[WS] onerror:', ev?.message ?? ev?.type ?? typeof ev, Object.keys(ev ?? {}));
    };

    ws.onclose = (ev) => {
      clearTimeout(globalTimeout);
      if (gotFrame) return;
      fail(`WebSocket đóng (chưa có frame): code=${ev.code} reason="${ev.reason}" wasClean=${ev.wasClean}`);
    };
  });
}

// --- Main ---
async function main() {
  const wavBuf = await fetchTtsWav('Xin chào, tôi là trợ lý hành chính công.');
  const jpegBuf = await grabFirstFrame(wavBuf);
  writeFileSync(OUT_PATH, jpegBuf);
  console.log('✓ Đã lưu:', OUT_PATH);
}

main().catch((err) => {
  console.error('Lỗi:', err.message);
  process.exit(1);
});
