import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { citizens } from '../../db/schema.js';
import { hashCccd } from '../../utils/crypto/index.js';

export type Citizen = typeof citizens.$inferSelect;

export async function findByCccdHash(cccdHash: string): Promise<Citizen | null> {
  const rows = await db.select().from(citizens).where(eq(citizens.cccdHash, cccdHash)).limit(1);
  return rows[0] ?? null;
}

export async function findOrCreate(
  cccdNumber: string,
): Promise<{ citizen: Citizen; isNew: boolean }> {
  const cccdHash = hashCccd(cccdNumber);

  const existing = await findByCccdHash(cccdHash);
  if (existing) {
    const now = new Date();
    await db.update(citizens).set({ lastLoginAt: now }).where(eq(citizens.id, existing.id));
    return { citizen: { ...existing, lastLoginAt: now }, isNew: false };
  }

  try {
    const [inserted] = await db.insert(citizens).values({ cccdHash, lastLoginAt: new Date() }).returning();
    if (!inserted) throw new Error('findOrCreate: insert returned no row');
    return { citizen: inserted, isNew: true };
  } catch (err) {
    const raced = await findByCccdHash(cccdHash);
    if (raced) return { citizen: raced, isNew: false };
    throw err;
  }
}

export async function touchLastLogin(citizenId: number): Promise<void> {
  await db.update(citizens).set({ lastLoginAt: new Date() }).where(eq(citizens.id, citizenId));
}

export async function findById(citizenId: number): Promise<Citizen | null> {
  const rows = await db.select().from(citizens).where(eq(citizens.id, citizenId)).limit(1);
  return rows[0] ?? null;
}
