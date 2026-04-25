import { createHash, randomBytes } from 'node:crypto';
import { Client as MinioClient } from 'minio';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { citizens } from '../../db/schema.js';
import { encrypt, decrypt } from '../../utils/crypto/aes.js';
import { deriveCitizenKey } from '../../utils/crypto/kms.js';
import { env } from '../../config/env.js';

const minio = new MinioClient({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL === 'true',
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});

const BUCKET = env.MINIO_BUCKET;
const SALT_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;
const HEADER_LEN = SALT_LEN + IV_LEN + TAG_LEN;

let bucketEnsured = false;
async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return;
  const exists = await minio.bucketExists(BUCKET);
  if (!exists) await minio.makeBucket(BUCKET, 'us-east-1');
  bucketEnsured = true;
}

async function getCitizenHash(citizenId: number): Promise<string> {
  const rows = await db.select({ cccdHash: citizens.cccdHash }).from(citizens).where(eq(citizens.id, citizenId)).limit(1);
  if (!rows[0]) throw new Error(`Citizen ${citizenId} not found`);
  return rows[0].cccdHash;
}

function packBlob(salt: Buffer, iv: Buffer, authTag: Buffer, ct: Buffer): Buffer {
  return Buffer.concat([salt, iv, authTag, ct]);
}

function unpackBlob(blob: Buffer) {
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
  await minio.putObject(BUCKET, fileKey, blob, blob.length, {
    'Content-Type': 'application/octet-stream',
    'x-amz-meta-ext': params.ext ?? 'jpg',
    'x-amz-meta-doc-code': params.docCode,
  });
  return { fileKey, checksum, size: params.plaintext.length };
}

export async function downloadDecrypted(params: { fileKey: string; citizenId: number }): Promise<Buffer> {
  await ensureBucket();
  const stream = await minio.getObject(BUCKET, params.fileKey);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const blob = Buffer.concat(chunks);
  const { salt, iv, authTag, ciphertext } = unpackBlob(blob);
  const cccdHash = await getCitizenHash(params.citizenId);
  const key = await deriveCitizenKey(cccdHash, salt);
  return decrypt(key, { ciphertext, iv, authTag });
}

export async function deleteFile(fileKey: string): Promise<void> {
  await ensureBucket();
  await minio.removeObject(BUCKET, fileKey);
}
