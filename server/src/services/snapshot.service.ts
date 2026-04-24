/**
 * Snapshot service — quản lý PII vault mã hoá.
 *
 * Flow:
 *  1. User scan CCCD → chip trả full PII → server.createSnapshot()
 *     - derive key per-citizen với random salt
 *     - AES-256-GCM encrypt PII JSON
 *     - insert identity_snapshots với TTL 48h
 *     - return snapshot_id
 *
 *  2. User quay lại sau 2 ngày → server.getActiveSnapshot(citizenId)
 *     - query latest snapshot chưa expired
 *     - return snapshot metadata (chưa decrypt)
 *
 *  3. Cần decrypt PII → server.decryptSnapshot(snapshotId, sessionId)
 *     - derive lại key từ citizen_hash + snapshot.salt
 *     - AES-GCM decrypt với iv/auth_tag
 *     - log snapshot_access_logs (audit)
 *     - increment access_count
 *     - return PII plaintext — caller PHẢI wipe sau khi dùng
 *
 *  4. Cron mỗi giờ → server.purgeExpired()
 *     - DELETE WHERE expires_at < now()
 *     - log purge_job_logs
 */
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { citizens, identitySnapshots, snapshotAccessLogs } from '../db/schema.js';
import {
  CURRENT_CIPHER_ALGORITHM,
  CURRENT_ENCRYPTION_VERSION,
  CURRENT_KDF_ALGORITHM,
  decryptJson,
  deriveCitizenKey,
  encryptJson,
  generateSalt,
  wipeBuffer,
} from './crypto/index.js';

export type IdentitySnapshot = typeof identitySnapshots.$inferSelect;

const SNAPSHOT_TTL_MS = 48 * 60 * 60 * 1000; // 48 tiếng theo policy

export type SnapshotSource = 'cccd_nfc' | 'vneid_api' | 'manual';

interface CreateSnapshotInput {
  citizenId: number;
  citizenHash: string; // hex64 — để derive key
  piiPayload: unknown; // full PII JSON từ CCCD chip / VNeID
  source: SnapshotSource;
  ttlMs?: number; // override default 48h
}

/**
 * Tạo snapshot mới — encrypt PII + save DB.
 */
export async function createSnapshot(
  input: CreateSnapshotInput,
): Promise<IdentitySnapshot> {
  const salt = generateSalt();
  const key = await deriveCitizenKey(input.citizenHash, salt);
  try {
    const blob = encryptJson(key, input.piiPayload);
    const expiresAt = new Date(Date.now() + (input.ttlMs ?? SNAPSHOT_TTL_MS));

    const rows = await db
      .insert(identitySnapshots)
      .values({
        citizenId: input.citizenId,
        ciphertext: blob.ciphertext,
        iv: blob.iv,
        authTag: blob.authTag,
        salt,
        encryptionVersion: CURRENT_ENCRYPTION_VERSION,
        kdfAlgorithm: CURRENT_KDF_ALGORITHM,
        cipherAlgorithm: CURRENT_CIPHER_ALGORITHM,
        source: input.source,
        expiresAt,
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error('createSnapshot: insert returned no row');
    return row;
  } finally {
    // Wipe key khỏi memory (best-effort V8)
    wipeBuffer(key);
  }
}

/**
 * Tìm snapshot đang active (chưa expire) của citizen.
 * Dùng khi user đăng nhập lại sau vài ngày.
 * Nếu có nhiều snapshot valid (hiếm — race condition), lấy mới nhất.
 */
export async function getActiveSnapshot(
  citizenId: number,
): Promise<IdentitySnapshot | null> {
  const rows = await db
    .select()
    .from(identitySnapshots)
    .where(
      and(
        eq(identitySnapshots.citizenId, citizenId),
        gt(identitySnapshots.expiresAt, new Date()),
      ),
    )
    .orderBy(sql`${identitySnapshots.createdAt} DESC`)
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Decrypt snapshot — trả PII plaintext.
 *
 * Quan trọng:
 *  - Caller PHẢI wipe returned object sau khi dùng (gán null + clear RAM)
 *  - Tự ghi audit log snapshot_access_logs
 *  - Tăng access_count — dùng để detect hành vi bất thường
 *
 * @throws nếu snapshot expired hoặc decrypt fail (sai key, tampered)
 */
export async function decryptSnapshot<T = unknown>(params: {
  snapshotId: number;
  sessionId: number;
}): Promise<T> {
  const { snapshotId, sessionId } = params;

  // Load snapshot + citizen hash trong 1 query
  const rows = await db
    .select({
      snapshot: identitySnapshots,
      citizenHash: citizens.cccdHash,
    })
    .from(identitySnapshots)
    .innerJoin(citizens, eq(citizens.id, identitySnapshots.citizenId))
    .where(eq(identitySnapshots.id, snapshotId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    await logAccess(snapshotId, sessionId, 'decrypt', false, 'snapshot not found');
    throw new Error(`Snapshot ${snapshotId} not found`);
  }

  // Verify chưa expire
  if (row.snapshot.expiresAt < new Date()) {
    await logAccess(snapshotId, sessionId, 'decrypt', false, 'snapshot expired');
    throw new Error(`Snapshot ${snapshotId} expired`);
  }

  // Derive lại key từ citizen_hash + salt
  const key = await deriveCitizenKey(row.citizenHash, Buffer.from(row.snapshot.salt));
  try {
    const plaintext = decryptJson<T>(key, {
      ciphertext: Buffer.from(row.snapshot.ciphertext),
      iv: Buffer.from(row.snapshot.iv),
      authTag: Buffer.from(row.snapshot.authTag),
    });
    await logAccess(snapshotId, sessionId, 'decrypt', true);
    // Update metrics (non-blocking fire-and-forget? Không — cần ensure log lưu)
    await db
      .update(identitySnapshots)
      .set({
        lastAccessedAt: new Date(),
        accessCount: sql`${identitySnapshots.accessCount} + 1`,
      })
      .where(eq(identitySnapshots.id, snapshotId));
    return plaintext;
  } catch (err) {
    await logAccess(
      snapshotId,
      sessionId,
      'decrypt',
      false,
      err instanceof Error ? err.message : String(err),
    );
    throw err;
  } finally {
    wipeBuffer(key);
  }
}

/**
 * Extend TTL thêm 48h — gọi khi user đăng nhập lại và muốn dùng tiếp snapshot.
 * KHÔNG extend quá 48h kể từ lần extend (không accumulate).
 */
export async function extendTtl(params: {
  snapshotId: number;
  sessionId: number;
  ttlMs?: number;
}): Promise<void> {
  const newExpiresAt = new Date(Date.now() + (params.ttlMs ?? SNAPSHOT_TTL_MS));
  await db
    .update(identitySnapshots)
    .set({ expiresAt: newExpiresAt })
    .where(eq(identitySnapshots.id, params.snapshotId));
  await logAccess(params.snapshotId, params.sessionId, 'extend_ttl', true);
}

/**
 * Cron job — xoá mọi snapshot đã expired.
 * Cascade xoá snapshot_access_logs (FK onDelete).
 *
 * @returns số record đã xoá
 */
export async function purgeExpired(): Promise<number> {
  const rows = await db
    .delete(identitySnapshots)
    .where(lt(identitySnapshots.expiresAt, new Date()))
    .returning({ id: identitySnapshots.id });
  return rows.length;
}

// ---------- Internal helpers ----------

async function logAccess(
  snapshotId: number,
  sessionId: number,
  accessType: 'decrypt' | 're_encrypt' | 'extend_ttl' | 'purge',
  success: boolean,
  errorMessage?: string,
): Promise<void> {
  try {
    await db.insert(snapshotAccessLogs).values({
      snapshotId,
      sessionId,
      accessType,
      success,
      errorMessage: errorMessage ?? null,
    });
  } catch (err) {
    // Nếu log fail, không throw làm vỡ flow chính — log stderr để admin biết
    console.error('[snapshot] audit log failed', err);
  }
}
