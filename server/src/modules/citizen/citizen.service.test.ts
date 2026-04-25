import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

beforeAll(() => {
  if (!process.env.K_MASTER) process.env.K_MASTER = Buffer.alloc(32, 1).toString('base64');
  if (!process.env.SYSTEM_SECRET) process.env.SYSTEM_SECRET = Buffer.alloc(32, 2).toString('base64');
});

const TEST_CCCD_PREFIX = '999';

describe('citizen.service', () => {
  beforeEach(async () => {
    const { db } = await import('../../db/client.js');
    const { citizens } = await import('../../db/schema.js');
    const { hashCccd } = await import('../../utils/crypto/index.js');
    const { inArray } = await import('drizzle-orm');
    const testHashes = Array.from({ length: 10 }, (_, i) =>
      hashCccd(TEST_CCCD_PREFIX + String(i + 1).padStart(9, '0')),
    );
    await db.delete(citizens).where(inArray(citizens.cccdHash, testHashes));
  });

  afterAll(async () => {
    const { sql: pgClient } = await import('../../db/client.js');
    await pgClient.end();
  });

  it('findOrCreate: tạo mới citizen lần đầu (isNew=true)', async () => {
    const { findOrCreate } = await import('./citizen.service.js');
    const { hashCccd } = await import('../../utils/crypto/index.js');
    const cccd = TEST_CCCD_PREFIX + '000000001';
    const { citizen, isNew } = await findOrCreate(cccd);
    expect(isNew).toBe(true);
    expect(citizen.cccdHash).toBe(hashCccd(cccd));
    expect(citizen.id).toBeGreaterThan(0);
  });

  it('findOrCreate: lần 2 cùng CCCD → isNew=false, cùng id', async () => {
    const { findOrCreate } = await import('./citizen.service.js');
    const cccd = TEST_CCCD_PREFIX + '000000002';
    const first = await findOrCreate(cccd);
    const second = await findOrCreate(cccd);
    expect(first.isNew).toBe(true);
    expect(second.isNew).toBe(false);
    expect(second.citizen.id).toBe(first.citizen.id);
  });

  it('findByCccdHash: tìm citizen đã tạo', async () => {
    const { findOrCreate, findByCccdHash } = await import('./citizen.service.js');
    const { hashCccd } = await import('../../utils/crypto/index.js');
    const cccd = TEST_CCCD_PREFIX + '000000003';
    const { citizen } = await findOrCreate(cccd);
    const found = await findByCccdHash(hashCccd(cccd));
    expect(found?.id).toBe(citizen.id);
  });

  it('findByCccdHash: trả null nếu không tồn tại', async () => {
    const { findByCccdHash } = await import('./citizen.service.js');
    const result = await findByCccdHash('nonexistent-hash-' + 'x'.repeat(48));
    expect(result).toBeNull();
  });

  it('findById: lookup bằng PK', async () => {
    const { findOrCreate, findById } = await import('./citizen.service.js');
    const cccd = TEST_CCCD_PREFIX + '000000004';
    const { citizen } = await findOrCreate(cccd);
    const found = await findById(citizen.id);
    expect(found?.id).toBe(citizen.id);
  });

  it('touchLastLogin: cập nhật last_login_at', async () => {
    const { findOrCreate, touchLastLogin, findById } = await import('./citizen.service.js');
    const cccd = TEST_CCCD_PREFIX + '000000005';
    const { citizen } = await findOrCreate(cccd);
    await new Promise((r) => setTimeout(r, 50));
    await touchLastLogin(citizen.id);
    const refreshed = await findById(citizen.id);
    expect(refreshed!.lastLoginAt!.getTime()).toBeGreaterThan(citizen.lastLoginAt!.getTime());
  });
});
