/**
 * Session service — tạo phiên đăng nhập sau khi user xác thực CCCD + face.
 *
 * Flow create:
 *  1. findOrCreate citizen từ cccd → cccdHash (service citizen)
 *  2. ensureDefaultKiosk → lấy kioskId mặc định (dev không có multi-kiosk config)
 *  3. Generate sessionToken (cryptographically random 32 bytes hex)
 *  4. Insert sessions row
 *  5. Return {sessionToken, sessionId, citizenId, isNewCitizen}
 *
 * Security:
 *  - KHÔNG lưu cccd plaintext — chỉ hash (qua findOrCreate)
 *  - sessionToken hex 64 ký tự — dùng làm bearer cho các request tiếp theo
 *  - Kiosk default dev — production sẽ bind từ hardware fingerprint
 */
import { randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { kiosks, sessions } from '../db/schema.js';
import { findOrCreate as findOrCreateCitizen } from './citizen.service.js';

const DEFAULT_KIOSK_CODE = 'KIOSK-DEV-001';

/**
 * Tìm/tạo kiosk mặc định cho dev. Production sẽ bind từ hardware ID khi boot.
 * Idempotent — gọi nhiều lần không tạo duplicate (unique device_code).
 */
async function ensureDefaultKiosk(): Promise<number> {
  const existing = await db
    .select({ id: kiosks.id })
    .from(kiosks)
    .where(eq(kiosks.deviceCode, DEFAULT_KIOSK_CODE))
    .limit(1);
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
  /** Số CCCD 12 chữ số raw — backend tự hash, không lưu plaintext */
  cccdNumber: string;
  /** Phương thức đăng nhập: cccd_nfc | vneid | qr | guest */
  loginMethod: 'cccd_nfc' | 'vneid' | 'qr' | 'guest';
  /** Đã verify face match chưa (true nếu bước face-verify đã OK) */
  identityVerified?: boolean;
}

export interface CreateSessionResult {
  sessionId: number;
  sessionToken: string;
  citizenId: number;
  isNewCitizen: boolean;
}

export async function createSession(
  params: CreateSessionParams,
): Promise<CreateSessionResult> {
  const { citizen, isNew } = await findOrCreateCitizen(params.cccdNumber);
  const kioskId = await ensureDefaultKiosk();

  // 32 bytes = 64 hex chars — đủ entropy cho session bearer
  const sessionToken = randomBytes(32).toString('hex');

  const [inserted] = await db
    .insert(sessions)
    .values({
      kioskId,
      citizenId: citizen.id,
      sessionToken,
      loginMethod: params.loginMethod,
      identityVerified: params.identityVerified ?? false,
    })
    .returning({ id: sessions.id });

  if (!inserted) throw new Error('createSession: insert failed');

  return {
    sessionId: inserted.id,
    sessionToken,
    citizenId: citizen.id,
    isNewCitizen: isNew,
  };
}

export interface ValidatedSession {
  sessionId: number;
  citizenId: number | null;
  kioskId: number;
}

/**
 * Validate sessionToken từ Authorization header.
 * Trả về session data nếu hợp lệ + chưa expired, null nếu không.
 */
export async function validateSession(
  token: string,
): Promise<ValidatedSession | null> {
  if (!token || token.length !== 64) return null;

  const rows = await db
    .select({
      id: sessions.id,
      citizenId: sessions.citizenId,
      kioskId: sessions.kioskId,
      endedAt: sessions.endedAt,
    })
    .from(sessions)
    .where(and(eq(sessions.sessionToken, token), isNull(sessions.endedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    sessionId: row.id,
    citizenId: row.citizenId,
    kioskId: row.kioskId,
  };
}
