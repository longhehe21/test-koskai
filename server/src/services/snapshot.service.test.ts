/**
 * Integration test snapshot service — full flow encrypt/decrypt/TTL/purge.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

beforeAll(() => {
  if (!process.env.K_MASTER) {
    process.env.K_MASTER = Buffer.alloc(32, 1).toString('base64');
  }
  if (!process.env.SYSTEM_SECRET) {
    process.env.SYSTEM_SECRET = Buffer.alloc(32, 2).toString('base64');
  }
});

const TEST_PREFIX = '998';

interface TestFixtures {
  citizenId: number;
  citizenHash: string;
  sessionId: number;
}

/** Tạo 1 citizen + 1 session để snapshot test tham chiếu. */
async function setupFixtures(): Promise<TestFixtures> {
  const { db } = await import('../db/index.js');
  const { citizens, kiosks, sessions, snapshotAccessLogs, identitySnapshots } =
    await import('../db/schema.js');
  const { hashCccd } = await import('./crypto/index.js');

  const cccd = TEST_PREFIX + '000000001';
  const cccdHash = hashCccd(cccd);

  // Cleanup residue đúng thứ tự FK:
  // snapshot_access_logs → sessions → snapshots → citizens, kiosks
  const { eq, like, inArray } = await import('drizzle-orm');

  const testCitizens = await db
    .select({ id: citizens.id })
    .from(citizens)
    .where(eq(citizens.cccdHash, cccdHash));
  const testKiosks = await db
    .select({ id: kiosks.id })
    .from(kiosks)
    .where(like(kiosks.deviceCode, 'TEST-SNAP%'));

  const citizenIds = testCitizens.map((c) => c.id);
  const kioskIds = testKiosks.map((k) => k.id);

  if (citizenIds.length > 0 || kioskIds.length > 0) {
    // Find related sessions
    const relatedSessions = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        citizenIds.length > 0 && kioskIds.length > 0
          ? inArray(sessions.citizenId, citizenIds)
          : citizenIds.length > 0
            ? inArray(sessions.citizenId, citizenIds)
            : inArray(sessions.kioskId, kioskIds),
      );
    const sessionIds = relatedSessions.map((s) => s.id);

    // Delete snapshot_access_logs referring to test sessions
    if (sessionIds.length > 0) {
      await db
        .delete(snapshotAccessLogs)
        .where(inArray(snapshotAccessLogs.sessionId, sessionIds));
      await db.delete(sessions).where(inArray(sessions.id, sessionIds));
    }

    // Delete snapshots of test citizens (sessions.snapshotId SET NULL handled)
    if (citizenIds.length > 0) {
      await db
        .delete(identitySnapshots)
        .where(inArray(identitySnapshots.citizenId, citizenIds));
      await db.delete(citizens).where(inArray(citizens.id, citizenIds));
    }

    if (kioskIds.length > 0) {
      await db.delete(kiosks).where(inArray(kiosks.id, kioskIds));
    }
  }

  // Create citizen
  const [citizen] = await db
    .insert(citizens)
    .values({ cccdHash, lastLoginAt: new Date() })
    .returning();

  // Create kiosk
  const [kiosk] = await db
    .insert(kiosks)
    .values({
      deviceCode: 'TEST-SNAP-' + Date.now(),
      deviceName: 'Test Kiosk',
      location: 'Test',
    })
    .returning();

  // Create session
  const [session] = await db
    .insert(sessions)
    .values({
      kioskId: kiosk!.id,
      citizenId: citizen!.id,
      sessionToken: 'test-token-' + Date.now(),
      loginMethod: 'cccd_nfc',
    })
    .returning();

  return {
    citizenId: citizen!.id,
    citizenHash: cccdHash,
    sessionId: session!.id,
  };
}

describe('snapshot.service', () => {
  let fixtures: TestFixtures;

  beforeEach(async () => {
    fixtures = await setupFixtures();
  });

  afterAll(async () => {
    const { sql: pgClient } = await import('../db/index.js');
    await pgClient.end();
  });

  it('createSnapshot: encrypt + lưu DB với TTL 48h', async () => {
    const { createSnapshot } = await import('./snapshot.service.js');

    const pii = {
      hoTen: 'Nguyễn Văn A',
      ngaySinh: '01/01/2000',
      thuongTru: 'Hà Nội',
    };
    const beforeCreate = Date.now();
    const snap = await createSnapshot({
      citizenId: fixtures.citizenId,
      citizenHash: fixtures.citizenHash,
      piiPayload: pii,
      source: 'cccd_nfc',
    });

    expect(snap.id).toBeGreaterThan(0);
    expect(snap.citizenId).toBe(fixtures.citizenId);
    expect(snap.ciphertext).toBeInstanceOf(Buffer);
    expect(snap.iv).toHaveLength(12);
    expect(snap.authTag).toHaveLength(16);
    expect(snap.salt).toHaveLength(32);
    expect(snap.source).toBe('cccd_nfc');
    expect(snap.accessCount).toBe(0);

    // TTL ~48h từ thời điểm gọi createSnapshot. Dùng JS Date.now() vì DB
    // timestamp có thể lệch timezone so với JS runtime.
    const ttlFromNow = snap.expiresAt.getTime() - beforeCreate;
    const FOURTY_EIGHT_H = 48 * 60 * 60 * 1000;
    expect(Math.abs(ttlFromNow - FOURTY_EIGHT_H)).toBeLessThan(10_000); // ±10s
  }, 30_000);

  it('decryptSnapshot: lấy lại nguyên vẹn PII', async () => {
    const { createSnapshot, decryptSnapshot } = await import('./snapshot.service.js');

    const pii = {
      hoTen: 'Trần Thị B',
      cccd: '999999999999',
      giaDinh: [
        { quanHe: 'con', hoTen: 'Bé X' },
        { quanHe: 'con', hoTen: 'Bé Y' },
      ],
    };
    const snap = await createSnapshot({
      citizenId: fixtures.citizenId,
      citizenHash: fixtures.citizenHash,
      piiPayload: pii,
      source: 'vneid_api',
    });

    const decrypted = await decryptSnapshot<typeof pii>({
      snapshotId: snap.id,
      sessionId: fixtures.sessionId,
    });

    expect(decrypted).toEqual(pii);
    expect(decrypted.giaDinh).toHaveLength(2);
  }, 60_000);

  it('decryptSnapshot: tăng access_count + log audit', async () => {
    const { createSnapshot, decryptSnapshot } = await import('./snapshot.service.js');
    const { db } = await import('../db/index.js');
    const { identitySnapshots, snapshotAccessLogs } = await import('../db/schema.js');
    const { eq } = await import('drizzle-orm');

    const snap = await createSnapshot({
      citizenId: fixtures.citizenId,
      citizenHash: fixtures.citizenHash,
      piiPayload: { test: true },
      source: 'cccd_nfc',
    });

    await decryptSnapshot({ snapshotId: snap.id, sessionId: fixtures.sessionId });
    await decryptSnapshot({ snapshotId: snap.id, sessionId: fixtures.sessionId });

    const [refreshed] = await db
      .select()
      .from(identitySnapshots)
      .where(eq(identitySnapshots.id, snap.id));
    expect(refreshed!.accessCount).toBe(2);

    const logs = await db
      .select()
      .from(snapshotAccessLogs)
      .where(eq(snapshotAccessLogs.snapshotId, snap.id));
    expect(logs).toHaveLength(2);
    expect(logs.every((l) => l.success && l.accessType === 'decrypt')).toBe(true);
  }, 60_000);

  it('getActiveSnapshot: tìm snapshot chưa expired', async () => {
    const { createSnapshot, getActiveSnapshot } = await import(
      './snapshot.service.js'
    );

    const snap = await createSnapshot({
      citizenId: fixtures.citizenId,
      citizenHash: fixtures.citizenHash,
      piiPayload: { x: 1 },
      source: 'cccd_nfc',
    });
    const active = await getActiveSnapshot(fixtures.citizenId);
    expect(active?.id).toBe(snap.id);
  }, 30_000);

  it('getActiveSnapshot: skip snapshot đã expired', async () => {
    const { createSnapshot, getActiveSnapshot } = await import(
      './snapshot.service.js'
    );

    await createSnapshot({
      citizenId: fixtures.citizenId,
      citizenHash: fixtures.citizenHash,
      piiPayload: { expired: true },
      source: 'cccd_nfc',
      ttlMs: -1000, // đã expire 1s trước
    });

    const active = await getActiveSnapshot(fixtures.citizenId);
    expect(active).toBeNull();
  }, 30_000);

  it('purgeExpired: xoá snapshot hết hạn', async () => {
    const { createSnapshot, purgeExpired, getActiveSnapshot } = await import(
      './snapshot.service.js'
    );

    // 1 expired + 1 active
    await createSnapshot({
      citizenId: fixtures.citizenId,
      citizenHash: fixtures.citizenHash,
      piiPayload: { stale: true },
      source: 'cccd_nfc',
      ttlMs: -1000,
    });
    const active = await createSnapshot({
      citizenId: fixtures.citizenId,
      citizenHash: fixtures.citizenHash,
      piiPayload: { live: true },
      source: 'cccd_nfc',
    });

    const deleted = await purgeExpired();
    expect(deleted).toBeGreaterThanOrEqual(1);

    // Active vẫn còn
    const remaining = await getActiveSnapshot(fixtures.citizenId);
    expect(remaining?.id).toBe(active.id);
  }, 60_000);

  it('decryptSnapshot: throw nếu snapshot không tồn tại', async () => {
    const { decryptSnapshot } = await import('./snapshot.service.js');
    await expect(
      decryptSnapshot({ snapshotId: 99999999, sessionId: fixtures.sessionId }),
    ).rejects.toThrow(/not found/);
  });

  it('decryptSnapshot: throw nếu expired', async () => {
    const { createSnapshot, decryptSnapshot } = await import('./snapshot.service.js');

    const snap = await createSnapshot({
      citizenId: fixtures.citizenId,
      citizenHash: fixtures.citizenHash,
      piiPayload: { x: 1 },
      source: 'cccd_nfc',
      ttlMs: -1000,
    });

    await expect(
      decryptSnapshot({ snapshotId: snap.id, sessionId: fixtures.sessionId }),
    ).rejects.toThrow(/expired/);
  }, 30_000);
});
