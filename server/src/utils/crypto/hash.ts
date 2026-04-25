import { createHmac } from 'node:crypto';

const SYSTEM_SECRET = process.env.SYSTEM_SECRET;
if (!SYSTEM_SECRET) {
  throw new Error('SYSTEM_SECRET env var is required for HMAC hashing');
}
const SECRET_KEY = Buffer.from(SYSTEM_SECRET, 'base64');

export function hashCccd(cccdNumber: string): string {
  if (typeof cccdNumber !== 'string' || cccdNumber.length === 0) {
    throw new Error('cccdNumber must be non-empty string');
  }
  return createHmac('sha256', SECRET_KEY).update(cccdNumber, 'utf8').digest('hex');
}

export function verifyCccdHash(cccdNumber: string, expectedHash: string): boolean {
  const actual = hashCccd(cccdNumber);
  if (actual.length !== expectedHash.length) return false;
  let result = 0;
  for (let i = 0; i < actual.length; i++) {
    result |= actual.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return result === 0;
}
