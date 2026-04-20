/**
 * check-tts-format.mjs — Kiểm tra format thực tế của Google TTS LINEAR16 response.
 * Mục tiêu: xác định Google TTS có tự thêm WAV header hay không.
 *
 * Chạy: node scripts/check-tts-format.mjs
 * FILE NÀY CHỈ DÙNG ĐỂ DEBUG — KHÔNG COMMIT.
 */

const API_KEY = 'AIzaSyACicVSuP_FCrf_m8Craqb_rVfC6PaCKS8';

const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    input: { text: 'Xin chào' },
    voice: { languageCode: 'vi-VN', name: 'vi-VN-Neural2-A' },
    audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 16000 },
  }),
});

const { audioContent } = await res.json();
const raw = Buffer.from(audioContent, 'base64');

// Check magic bytes
const magic4 = raw.slice(0, 4).toString('ascii');
const magic8 = raw.slice(8, 12).toString('ascii');

console.log(`Total bytes: ${raw.length}`);
console.log(`First 4 bytes (ascii): "${magic4}"`);
console.log(`First 4 bytes (hex): ${raw.slice(0, 4).toString('hex')}`);
console.log(`Bytes 8-12 (ascii): "${magic8}"`);
console.log(`Is WAV: ${magic4 === 'RIFF' && magic8 === 'WAVE'}`);
console.log(`Is raw PCM (first bytes): ${raw[0].toString(16).padStart(2,'0')} ${raw[1].toString(16).padStart(2,'0')} ${raw[2].toString(16).padStart(2,'0')} ${raw[3].toString(16).padStart(2,'0')}`);

if (magic4 === 'RIFF') {
  const declaredSize = raw.readUInt32LE(4);
  const sampleRate = raw.readUInt32LE(24);
  const channels = raw.readUInt16LE(22);
  const bitsPerSample = raw.readUInt16LE(34);
  console.log(`\nWAV Header info:`);
  console.log(`  Sample rate: ${sampleRate} Hz`);
  console.log(`  Channels: ${channels}`);
  console.log(`  Bits per sample: ${bitsPerSample}`);
  console.log(`  Declared data size: ${declaredSize} bytes`);
  console.log(`\n→ Google TTS ĐÃ BAO GỒM WAV HEADER!`);
  console.log(`→ Trong tts.handler.ts và test script KHÔNG được thêm header lần nữa.`);
} else {
  console.log(`\n→ Google TTS trả về raw PCM (không có WAV header)`);
  console.log(`→ Cần thêm WAV header khi dùng.`);
}
