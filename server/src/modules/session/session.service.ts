import { randomBytes, createHash } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { kiosks, sessions } from '../../db/schema.js';
import { findOrCreate as findOrCreateCitizen } from '../citizen/citizen.service.js';

const DEFAULT_KIOSK_CODE = 'KIOSK-DEV-001';

async function ensureDefaultKiosk(): Promise<number> {
  const existing = await db.select({ id: kiosks.id }).from(kiosks).where(eq(kiosks.deviceCode, DEFAULT_KIOSK_CODE)).limit(1);
  if (existing[0]) return existing[0].id;

  const [inserted] = await db
    .insert(kiosks)
    .values({
      deviceCode: DEFAULT_KIOSK_CODE,
      deviceName: 'Kiosk Dev Default',
      location: 'Development',
      status: 'online',
      hasCamera: true,
      lastOnlineAt: new Date(),
    })
    .returning({ id: kiosks.id });
  if (!inserted) throw new Error('ensureDefaultKiosk: insert failed');
  return inserted.id;
}

export interface CreateSessionParams {
  cccdNumber: string;
  loginMethod: 'cccd_nfc' | 'vneid' | 'qr' | 'guest';
  identityVerified?: boolean;
}

export interface CreateSessionResult {
  sessionId: number;
  sessionToken: string;
  citizenId: number;
  isNewCitizen: boolean;
}

export async function createSession(params: CreateSessionParams): Promise<CreateSessionResult> {
  const { citizen, isNew } = await findOrCreateCitizen(params.cccdNumber);
  const kioskId = await ensureDefaultKiosk();

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  const [inserted] = await db
    .insert(sessions)
    .values({
      kioskId,
      citizenId: citizen.id,
      sessionToken: tokenHash,
      loginMethod: params.loginMethod,
      identityVerified: params.identityVerified ?? false,
    })
    .returning({ id: sessions.id });

  if (!inserted) throw new Error('createSession: insert failed');

  return {
    sessionId: inserted.id,
    sessionToken: rawToken,
    citizenId: citizen.id,
    isNewCitizen: isNew,
  };
}

export interface ValidatedSession {
  sessionId: number;
  citizenId: number | null;
  kioskId: number;
}

export async function validateSession(token: string): Promise<ValidatedSession | null> {
  if (!token || token.length !== 64) return null;

  const tokenHash = createHash('sha256').update(token).digest('hex');

  const rows = await db
    .select({
      id: sessions.id,
      citizenId: sessions.citizenId,
      kioskId: sessions.kioskId,
      endedAt: sessions.endedAt,
    })
    .from(sessions)
    .where(and(eq(sessions.sessionToken, tokenHash), isNull(sessions.endedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return { sessionId: row.id, citizenId: row.citizenId, kioskId: row.kioskId };
}
