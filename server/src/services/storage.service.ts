/**
 * Storage service — MinIO client với encryption layer.
 *
 * Flow upload:
 *  1. Generate random salt 32 bytes
 *  2. deriveCitizenKey(cccdHash, salt) → Argon2id → 32-byte AES key
 *  3. encrypt(key, plaintext) → {iv, authTag, ciphertext}
 *  4. Pack blob: [salt(32) || iv(12) || authTag(16) || ciphertext] → put MinIO
 *
 * Flow download:
 *  1. Get object từ MinIO → blob
 *  2. Unpack: salt, iv, authTag, ciphertext
 *  3. deriveCitizenKey(cccdHash, salt) → key
 *  4. decrypt(key, blob) → return plaintext
 *
 * Bucket: auto-create idempotent (ensureBucket).
 */
import { createHash, randomBytes } from 'node:crypto';
import { Client as MinioClient } from 'minio';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { citizens } from '../db/schema.js';
import { encrypt, decrypt } from './crypto/aes.js';
import { deriveCitizenKey } from './crypto/kms.js';

const {
  MINIO_ENDPOINT = 'localhost',
  MINIO_PORT = '9000',
  MINIO_ACCESS_KEY = '',
  MINIO_SECRET_KEY = '',
  MINIO_BUCKET = 'kiosk-files',
  MINIO_USE_SSL = 'false',
} = process.env;

const minio = new MinioClient({
  endPoint: MINIO_ENDPOINT,
  port: Number(MINIO_PORT),
  useSSL: MINIO_USE_SSL === 'true',
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
});

const SALT_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;
const HEADER_LEN = SALT_LEN + IV_LEN + TAG_LEN; // 60 bytes

let bucketEnsured = false;
async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return;
  const exists = await minio.bucketExists(MINIO_BUCKET);
  if (!exists) await minio.makeBucket(MINIO_BUCKET, 'us-east-1');
  bucketEnsured = true;
}

/**
 * Lookup citizen.cccdHash — cần cho deriveCitizenKey.
 * Cache đơn giản: trong 1 request thường chỉ gọi 1 lần.
 */
async function getCitizenHash(citizenId: number): Promise<string> {
  const rows = await db
    .select({ cccdHash: citizens.cccdHash })
    .from(citizens)
    .where(eq(citizens.id, citizenId))
    .limit(1);
  if (!rows[0]) throw new Error(`Citizen ${citizenId} not found`);
  return rows[0].cccdHash;
}

function packBlob(salt: Buffer, iv: Buffer, authTag: Buffer, ct: Buffer): Buffer {
  return Buffer.concat([salt, iv, authTag, ct]);
}

function unpackBlob(blob: Buffer): {
  salt: Buffer;
  iv: Buffer;
  authTag: Buffer;
  ciphertext: Buffer;
} {
  if (blob.length < HEADER_LEN) throw new Error('Encrypted blob too short');
  return {
    salt: blob.subarray(0, SALT_LEN),
    iv: blob.subarray(SALT_LEN, SALT_LEN + IV_LEN),
    authTag: blob.subarray(SALT_LEN + IV_LEN, HEADER_LEN),
    ciphertext: blob.subarray(HEADER_LEN),
  };
}

export interface UploadResult {
  fileKey: string;
  /** SHA-256 hex của plaintext — verify integrity sau */
  checksum: string;
  size: number;
}

export async function uploadEncrypted(params: {
  citizenId: number;
  applicationId: number;
  docCode: string;
  plaintext: Buffer;
  ext?: string;
}): Promise<UploadResult> {
  await ensureBucket();

  const cccdHash = await getCitizenHash(params.citizenId);
  const salt = randomBytes(SALT_LEN);
  const key = await deriveCitizenKey(cccdHash, salt);
  const { iv, authTag, ciphertext } = encrypt(key, params.plaintext);
  const blob = packBlob(salt, iv, authTag, ciphertext);

  const checksum = createHash('sha256').update(params.plaintext).digest('hex');

  const ts = Date.now();
  const rand = randomBytes(3).toString('hex');
  const safeDocCode = params.docCode.replace(/[^a-z0-9-]/gi, '_').slice(0, 50);
  const fileKey = `${params.citizenId}/${params.applicationId}/${safeDocCode}-${ts}-${rand}.enc`;

  await minio.putObject(MINIO_BUCKET, fileKey, blob, blob.length, {
    'Content-Type': 'application/octet-stream',
    'x-amz-meta-ext': params.ext ?? 'jpg',
    'x-amz-meta-doc-code': params.docCode,
  });

  return { fileKey, checksum, size: params.plaintext.length };
}

export async function downloadDecrypted(params: {
  fileKey: string;
  citizenId: number;
}): Promise<Buffer> {
  await ensureBucket();

  const stream = await minio.getObject(MINIO_BUCKET, params.fileKey);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  const blob = Buffer.concat(chunks);

  const { salt, iv, authTag, ciphertext } = unpackBlob(blob);
  const cccdHash = await getCitizenHash(params.citizenId);
  const key = await deriveCitizenKey(cccdHash, salt);
  return decrypt(key, { ciphertext, iv, authTag });
}

export async function deleteFile(fileKey: string): Promise<void> {
  await ensureBucket();
  await minio.removeObject(MINIO_BUCKET, fileKey);
}
