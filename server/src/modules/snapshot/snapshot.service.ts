import { and, eq, gt, lt, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { citizens, identitySnapshots, snapshotAccessLogs } from '../../db/schema.js';
import {
  CURRENT_CIPHER_ALGORITHM,
  CURRENT_ENCRYPTION_VERSION,
  CURRENT_KDF_ALGORITHM,
  decryptJson,
  deriveCitizenKey,
  encryptJson,
  generateSalt,
  wipeBuffer,
} from '../../utils/crypto/index.js';

export type IdentitySnapshot = typeof identitySnapshots.$inferSelect;

const SNAPSHOT_TTL_MS = 48 * 60 * 60 * 1000;

export type SnapshotSource = 'cccd_nfc' | 'vneid_api' | 'manual';

interface CreateSnapshotInput {
  citizenId: number;
  citizenHash: string;
  piiPayload: unknown;
  source: SnapshotSource;
  ttlMs?: number;
}

export async function createSnapshot(input: CreateSnapshotInput): Promise<IdentitySnapshot> {
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
    wipeBuffer(key);
  }
}

export async function getActiveSnapshot(citizenId: number): Promise<IdentitySnapshot | null> {
  const rows = await db
    .select()
    .from(identitySnapshots)
    .where(and(eq(identitySnapshots.citizenId, citizenId), gt(identitySnapshots.expiresAt, new Date())))
    .orderBy(sql`${identitySnapshots.createdAt} DESC`)
    .limit(1);
  return rows[0] ?? null;
}

export async function decryptSnapshot<T = unknown>(params: {
  snapshotId: number;
  sessionId: number;
}): Promise<T> {
  const { snapshotId, sessionId } = params;

  const rows = await db
    .select({ snapshot: identitySnapshots, citizenHash: citizens.cccdHash })
    .from(identitySnapshots)
    .innerJoin(citizens, eq(citizens.id, identitySnapshots.citizenId))
    .where(eq(identitySnapshots.id, snapshotId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    await logAccess(snapshotId, sessionId, 'decrypt', false, 'snapshot not found');
    throw new Error(`Snapshot ${snapshotId} not found`);
  }

  if (row.snapshot.expiresAt < new Date()) {
    await logAccess(snapshotId, sessionId, 'decrypt', false, 'snapshot expired');
    throw new Error(`Snapshot ${snapshotId} expired`);
  }

  const key = await deriveCitizenKey(row.citizenHash, Buffer.from(row.snapshot.salt));
  try {
    const plaintext = decryptJson<T>(key, {
      ciphertext: Buffer.from(row.snapshot.ciphertext),
      iv: Buffer.from(row.snapshot.iv),
      authTag: Buffer.from(row.snapshot.authTag),
    });
    await logAccess(snapshotId, sessionId, 'decrypt', true);
    await db
      .update(identitySnapshots)
      .set({ lastAccessedAt: new Date(), accessCount: sql`${identitySnapshots.accessCount} + 1` })
      .where(eq(identitySnapshots.id, snapshotId));
    return plaintext;
  } catch (err) {
    await logAccess(snapshotId, sessionId, 'decrypt', false, err instanceof Error ? err.message : String(err));
    throw err;
  } finally {
    wipeBuffer(key);
  }
}

export async function extendTtl(params: {
  snapshotId: number;
  sessionId: number;
  ttlMs?: number;
}): Promise<void> {
  const newExpiresAt = new Date(Date.now() + (params.ttlMs ?? SNAPSHOT_TTL_MS));
  await db.update(identitySnapshots).set({ expiresAt: newExpiresAt }).where(eq(identitySnapshots.id, params.snapshotId));
  await logAccess(params.snapshotId, params.sessionId, 'extend_ttl', true);
}

export async function purgeExpired(): Promise<number> {
  const rows = await db.delete(identitySnapshots).where(lt(identitySnapshots.expiresAt, new Date())).returning({ id: identitySnapshots.id });
  return rows.length;
}

async function logAccess(
  snapshotId: number,
  sessionId: number,
  accessType: 'decrypt' | 're_encrypt' | 'extend_ttl' | 'purge',
  success: boolean,
  errorMessage?: string,
): Promise<void> {
  try {
    await db.insert(snapshotAccessLogs).values({ snapshotId, sessionId, accessType, success, errorMessage: errorMessage ?? null });
  } catch (err) {
    console.error('[snapshot] audit log failed', err);
  }
}
