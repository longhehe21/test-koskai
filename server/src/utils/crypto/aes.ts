import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export interface EncryptedBlob {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

export function encrypt(key: Buffer, plaintext: string | Buffer): EncryptedBlob {
  validateKey(key);
  const plainBuf = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(plainBuf), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}

export function decrypt(key: Buffer, blob: EncryptedBlob): Buffer {
  validateKey(key);
  if (blob.iv.length !== IV_LENGTH) {
    throw new Error(`IV must be ${IV_LENGTH} bytes, got ${blob.iv.length}`);
  }
  if (blob.authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`authTag must be ${AUTH_TAG_LENGTH} bytes, got ${blob.authTag.length}`);
  }
  const decipher = createDecipheriv('aes-256-gcm', key, blob.iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(blob.authTag);
  return Buffer.concat([decipher.update(blob.ciphertext), decipher.final()]);
}

export function decryptJson<T = unknown>(key: Buffer, blob: EncryptedBlob): T {
  const plain = decrypt(key, blob).toString('utf8');
  return JSON.parse(plain) as T;
}

export function encryptJson(key: Buffer, obj: unknown): EncryptedBlob {
  return encrypt(key, JSON.stringify(obj));
}

function validateKey(key: Buffer): void {
  if (!Buffer.isBuffer(key) || key.length !== KEY_LENGTH) {
    throw new Error(`Key must be Buffer of ${KEY_LENGTH} bytes, got ${key?.length ?? typeof key}`);
  }
}
