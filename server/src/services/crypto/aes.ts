/**
 * AES-256-GCM encryption — dùng cho PII vault + form_data ciphertext.
 *
 * Vì sao AES-GCM:
 *  - Authenticated encryption (AEAD) — auth_tag verify integrity + authenticity
 *  - Hacker sửa ciphertext → decrypt fail (tamper detection)
 *  - NIST chuẩn, không có vuln nghiêm trọng khi dùng đúng
 *
 * Rules an toàn TUYỆT ĐỐI:
 *  - IV (nonce) 12 bytes random PER encryption — KHÔNG BAO GIỜ reuse IV với same key
 *  - Key 32 bytes (AES-256)
 *  - auth_tag 16 bytes — verify ở decrypt, fail thì throw
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const IV_LENGTH = 12; // GCM recommended
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // AES-256

export interface EncryptedBlob {
  ciphertext: Buffer;
  iv: Buffer; // 12 bytes
  authTag: Buffer; // 16 bytes
}

/**
 * Encrypt plaintext bằng AES-256-GCM.
 * @param key — 32 bytes (AES-256 key). Cho phép Buffer hoặc Uint8Array.
 * @param plaintext — string UTF-8 hoặc Buffer
 * @returns {ciphertext, iv, authTag} — tất cả Buffer, lưu DB bytea
 */
export function encrypt(key: Buffer, plaintext: string | Buffer): EncryptedBlob {
  validateKey(key);
  const plainBuf = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(plainBuf), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}

/**
 * Decrypt blob. Throw nếu auth_tag không khớp (ciphertext bị sửa hoặc sai key).
 */
export function decrypt(key: Buffer, blob: EncryptedBlob): Buffer {
  validateKey(key);
  if (blob.iv.length !== IV_LENGTH) {
    throw new Error(`IV must be ${IV_LENGTH} bytes, got ${blob.iv.length}`);
  }
  if (blob.authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`authTag must be ${AUTH_TAG_LENGTH} bytes, got ${blob.authTag.length}`);
  }
  const decipher = createDecipheriv('aes-256-gcm', key, blob.iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(blob.authTag);
  // decipher.final() sẽ throw 'Unsupported state or unable to authenticate data'
  // nếu authTag không match → caller catch và log security event.
  return Buffer.concat([decipher.update(blob.ciphertext), decipher.final()]);
}

/** Decrypt và parse JSON thẳng — shortcut phổ biến. */
export function decryptJson<T = unknown>(key: Buffer, blob: EncryptedBlob): T {
  const plain = decrypt(key, blob).toString('utf8');
  return JSON.parse(plain) as T;
}

/** Encrypt object sau khi JSON stringify — shortcut ngược. */
export function encryptJson(key: Buffer, obj: unknown): EncryptedBlob {
  return encrypt(key, JSON.stringify(obj));
}

function validateKey(key: Buffer): void {
  if (!Buffer.isBuffer(key) || key.length !== KEY_LENGTH) {
    throw new Error(`Key must be Buffer of ${KEY_LENGTH} bytes, got ${key?.length ?? typeof key}`);
  }
}
