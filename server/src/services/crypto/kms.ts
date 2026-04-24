/**
 * KMS — Key Management Service.
 *
 * Dẫn xuất per-citizen key từ K_MASTER + citizen_hash + per-vault salt.
 * Công thức: K_c = Argon2id(K_MASTER || citizen_hash, salt)
 *
 * Tại sao per-vault salt:
 *  - 2 citizen cùng hash (cực kỳ hiếm collision) vẫn có key khác nhau vì salt khác
 *  - Thay đổi salt → re-encrypt; dùng cho key rotation
 *
 * Tại sao Argon2id:
 *  - Chống GPU brute force tốt hơn PBKDF2/bcrypt
 *  - Memory-hard: cần 64MB RAM per hash → GPU bị chậm vì VRAM giới hạn
 *  - OWASP 2023 recommendation
 *
 * Argon2 params (balance dev laptop / prod server):
 *  - memoryCost: 64 MiB = 65536 KiB
 *  - timeCost: 3 iterations
 *  - parallelism: 4 threads
 *  - hashLength: 32 bytes (để có AES-256 key)
 */
import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

const K_MASTER_B64 = process.env.K_MASTER;
if (!K_MASTER_B64) {
  throw new Error('K_MASTER env var is required for KMS');
}
const K_MASTER = Buffer.from(K_MASTER_B64, 'base64');
if (K_MASTER.length !== 32) {
  throw new Error(`K_MASTER must decode to 32 bytes, got ${K_MASTER.length}`);
}

const ARGON2_OPTS = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
  raw: true as const,
} satisfies Parameters<typeof argon2.hash>[1];

export const CURRENT_ENCRYPTION_VERSION = 1;
export const CURRENT_KDF_ALGORITHM = 'argon2id';
export const CURRENT_CIPHER_ALGORITHM = 'aes-256-gcm';
export const DEFAULT_SALT_LENGTH = 32;

/**
 * Sinh salt random 32 bytes cho vault mới.
 * Mỗi snapshot/application nên có salt riêng.
 */
export function generateSalt(length: number = DEFAULT_SALT_LENGTH): Buffer {
  return randomBytes(length);
}

/**
 * Derive AES-256 key per-citizen từ K_MASTER + citizen_hash + salt.
 *
 * @param citizenHash — hex string 64 chars từ hash.ts
 * @param salt — random bytes per vault (lưu plain trong DB)
 * @returns 32 bytes Buffer, dùng làm AES-256 key
 *
 * Performance: ~200-400ms trên laptop dev. Cache nếu cần decrypt nhiều lần
 * trong cùng session (nhưng cẩn thận memory leak PII).
 */
export async function deriveCitizenKey(
  citizenHash: string,
  salt: Buffer,
): Promise<Buffer> {
  if (!citizenHash || citizenHash.length !== 64) {
    throw new Error('citizenHash must be 64 hex chars');
  }
  if (!Buffer.isBuffer(salt) || salt.length < 16) {
    throw new Error('salt must be Buffer >= 16 bytes');
  }

  // Concat K_MASTER + citizen_hash làm "password" input cho Argon2
  // Buffer.from(citizenHash, 'hex') thay vì utf8 → 32 bytes thay vì 64
  const password = Buffer.concat([K_MASTER, Buffer.from(citizenHash, 'hex')]);
  const key = await argon2.hash(password, { ...ARGON2_OPTS, salt });
  return key as unknown as Buffer; // argon2 với raw:true trả Buffer
}

/**
 * Clear sensitive buffer khỏi memory (best-effort, V8 không đảm bảo).
 * Gọi sau khi dùng xong key để giảm window attack.
 */
export function wipeBuffer(buf: Buffer): void {
  if (Buffer.isBuffer(buf)) {
    buf.fill(0);
  }
}
