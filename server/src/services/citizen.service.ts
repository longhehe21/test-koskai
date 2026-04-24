/**
 * Citizen service — quản lý citizen records (chỉ hash, KHÔNG PII raw).
 *
 * Trách nhiệm:
 *  - Lookup citizen theo cccd_hash (khi user scan CCCD lần 2)
 *  - Create mới nếu chưa có (user scan lần đầu)
 *  - Update last_login_at (metric + audit)
 *
 * KHÔNG handle:
 *  - PII plaintext (snapshot service lo)
 *  - Session create (session service lo)
 */
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { citizens } from '../db/schema.js';
import { hashCccd } from './crypto/index.js';

export type Citizen = typeof citizens.$inferSelect;

/**
 * Find citizen theo cccd_hash. Dùng khi caller đã có hash sẵn (vd từ
 * session existing hoặc admin query).
 */
export async function findByCccdHash(cccdHash: string): Promise<Citizen | null> {
  const rows = await db
    .select()
    .from(citizens)
    .where(eq(citizens.cccdHash, cccdHash))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Find-or-create citizen từ số CCCD thô. Race-safe qua unique constraint.
 *
 * Flow:
 *  1. SELECT by cccd_hash → nếu có, touch last_login + return isNew=false
 *  2. INSERT → nếu success return isNew=true
 *  3. Nếu INSERT conflict (race với request khác) → SELECT lại
 *
 * @param cccdNumber — số CCCD 12 chữ số raw (hash bên trong)
 * @returns {citizen, isNew} — isNew=true nghĩa là lần đầu user dùng kiosk
 */
export async function findOrCreate(
  cccdNumber: string,
): Promise<{ citizen: Citizen; isNew: boolean }> {
  const cccdHash = hashCccd(cccdNumber);

  // Path 1: existing citizen
  const existing = await findByCccdHash(cccdHash);
  if (existing) {
    const now = new Date();
    await db
      .update(citizens)
      .set({ lastLoginAt: now })
      .where(eq(citizens.id, existing.id));
    return { citizen: { ...existing, lastLoginAt: now }, isNew: false };
  }

  // Path 2: create new — unique constraint là safety net cho race
  try {
    const [inserted] = await db
      .insert(citizens)
      .values({ cccdHash, lastLoginAt: new Date() })
      .returning();
    if (!inserted) throw new Error('findOrCreate: insert returned no row');
    return { citizen: inserted, isNew: true };
  } catch (err) {
    // Race: request khác đã insert trong khi mình check
    // Retry SELECT — nếu tìm được thì coi như "tìm thấy" (không phải new)
    const raced = await findByCccdHash(cccdHash);
    if (raced) return { citizen: raced, isNew: false };
    throw err; // Error khác (DB down...) — throw thật
  }
}

/**
 * Update last_login_at — gọi ở mỗi session khởi tạo mới để track hoạt động.
 * Idempotent — gọi nhiều lần không gây hại.
 */
export async function touchLastLogin(citizenId: number): Promise<void> {
  await db
    .update(citizens)
    .set({ lastLoginAt: new Date() })
    .where(eq(citizens.id, citizenId));
}

/**
 * Lookup bằng id — dùng khi đã có citizen_id từ session/application.
 */
export async function findById(citizenId: number): Promise<Citizen | null> {
  const rows = await db
    .select()
    .from(citizens)
    .where(eq(citizens.id, citizenId))
    .limit(1);
  return rows[0] ?? null;
}
