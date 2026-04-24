/**
 * HMAC hashing — định danh công dân bằng cccd_hash.
 *
 * Dùng HMAC-SHA256(cccd_number, SYSTEM_SECRET) thay vì hash thuần vì:
 *  - Hacker không thể rainbow-table nếu không có SYSTEM_SECRET
 *  - 1 chiều, không reverse được CCCD từ hash
 *  - Deterministic: cùng CCCD + cùng secret → cùng hash → match được citizen cũ
 *
 * SYSTEM_SECRET lưu trong env, phải rotate định kỳ (khi rotate → re-hash toàn
 * bộ citizens table, hoặc hỗ trợ dual-secret window).
 */
import { createHmac } from 'node:crypto';

const SYSTEM_SECRET = process.env.SYSTEM_SECRET;
if (!SYSTEM_SECRET) {
  throw new Error('SYSTEM_SECRET env var is required for HMAC hashing');
}
const SECRET_KEY = Buffer.from(SYSTEM_SECRET, 'base64');

/**
 * Hash số CCCD (12 chữ số) thành hex string 64 ký tự.
 * @param cccdNumber — số CCCD raw, không sanitize trong hàm này (caller lo)
 */
export function hashCccd(cccdNumber: string): string {
  if (typeof cccdNumber !== 'string' || cccdNumber.length === 0) {
    throw new Error('cccdNumber must be non-empty string');
  }
  return createHmac('sha256', SECRET_KEY).update(cccdNumber, 'utf8').digest('hex');
}

/**
 * Verify một cccd_hash có match với cccd_number cho trước không.
 * Constant-time comparison để chống timing attack.
 */
export function verifyCccdHash(cccdNumber: string, expectedHash: string): boolean {
  const actual = hashCccd(cccdNumber);
  if (actual.length !== expectedHash.length) return false;
  // Timing-safe equal
  let result = 0;
  for (let i = 0; i < actual.length; i++) {
    result |= actual.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return result === 0;
}
