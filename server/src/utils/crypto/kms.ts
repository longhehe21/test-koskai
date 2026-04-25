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
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
  raw: true as const,
} satisfies Parameters<typeof argon2.hash>[1];

export const CURRENT_ENCRYPTION_VERSION = 1;
export const CURRENT_KDF_ALGORITHM = 'argon2id';
export const CURRENT_CIPHER_ALGORITHM = 'aes-256-gcm';
export const DEFAULT_SALT_LENGTH = 32;

export function generateSalt(length: number = DEFAULT_SALT_LENGTH): Buffer {
  return randomBytes(length);
}

export async function deriveCitizenKey(citizenHash: string, salt: Buffer): Promise<Buffer> {
  if (!citizenHash || citizenHash.length !== 64) {
    throw new Error('citizenHash must be 64 hex chars');
  }
  if (!Buffer.isBuffer(salt) || salt.length < 16) {
    throw new Error('salt must be Buffer >= 16 bytes');
  }
  const password = Buffer.concat([K_MASTER, Buffer.from(citizenHash, 'hex')]);
  const key = await argon2.hash(password, { ...ARGON2_OPTS, salt });
  return key as unknown as Buffer;
}

export function wipeBuffer(buf: Buffer): void {
  if (Buffer.isBuffer(buf)) {
    buf.fill(0);
  }
}
