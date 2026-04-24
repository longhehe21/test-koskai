/**
 * Unit tests crypto layer.
 * Test coverage:
 *  - HMAC hash: deterministic + timing-safe verify
 *  - AES-GCM: encrypt-decrypt round-trip + tamper detection
 *  - KMS: derive key deterministic + per-salt uniqueness
 *  - JSON helpers: preserve structure
 *
 * Run: npm run test --workspace=server
 */
import { describe, expect, it, beforeAll } from 'vitest';

// Tests cần env SYSTEM_SECRET + K_MASTER. Set tại runtime trước khi import modules.
beforeAll(() => {
  // 32 bytes random base64 — match format env vars
  if (!process.env.K_MASTER) {
    process.env.K_MASTER = Buffer.alloc(32, 1).toString('base64');
  }
  if (!process.env.SYSTEM_SECRET) {
    process.env.SYSTEM_SECRET = Buffer.alloc(32, 2).toString('base64');
  }
});

describe('crypto/hash', () => {
  it('hashCccd: deterministic cùng input → cùng output', async () => {
    const { hashCccd } = await import('./hash.js');
    const h1 = hashCccd('012345678901');
    const h2 = hashCccd('012345678901');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64); // SHA-256 hex
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashCccd: input khác → output khác', async () => {
    const { hashCccd } = await import('./hash.js');
    expect(hashCccd('012345678901')).not.toBe(hashCccd('012345678902'));
  });

  it('verifyCccdHash: match correct', async () => {
    const { hashCccd, verifyCccdHash } = await import('./hash.js');
    const h = hashCccd('012345678901');
    expect(verifyCccdHash('012345678901', h)).toBe(true);
    expect(verifyCccdHash('999999999999', h)).toBe(false);
  });

  it('hashCccd: throw với input rỗng', async () => {
    const { hashCccd } = await import('./hash.js');
    expect(() => hashCccd('')).toThrow();
  });
});

describe('crypto/aes', () => {
  const KEY = Buffer.alloc(32, 3); // 32 bytes, all 0x03

  it('encrypt + decrypt round-trip text', async () => {
    const { encrypt, decrypt } = await import('./aes.js');
    const plain = 'Nguyễn Văn A - CCCD 012345678901';
    const blob = encrypt(KEY, plain);
    expect(blob.iv).toHaveLength(12);
    expect(blob.authTag).toHaveLength(16);
    expect(blob.ciphertext.length).toBeGreaterThan(0);
    const decrypted = decrypt(KEY, blob).toString('utf8');
    expect(decrypted).toBe(plain);
  });

  it('IV random: encrypt cùng text nhiều lần → ciphertext khác nhau', async () => {
    const { encrypt } = await import('./aes.js');
    const plain = 'same text';
    const a = encrypt(KEY, plain);
    const b = encrypt(KEY, plain);
    expect(a.iv.equals(b.iv)).toBe(false); // IV phải khác
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false); // ciphertext khác theo
  });

  it('tamper ciphertext → decrypt throw', async () => {
    const { encrypt, decrypt } = await import('./aes.js');
    const blob = encrypt(KEY, 'sensitive data');
    blob.ciphertext[0] ^= 0xff; // flip 1 byte
    expect(() => decrypt(KEY, blob)).toThrow();
  });

  it('sai key → decrypt throw', async () => {
    const { encrypt, decrypt } = await import('./aes.js');
    const blob = encrypt(KEY, 'secret');
    const wrongKey = Buffer.alloc(32, 4);
    expect(() => decrypt(wrongKey, blob)).toThrow();
  });

  it('encryptJson/decryptJson: preserve object structure', async () => {
    const { encryptJson, decryptJson } = await import('./aes.js');
    const obj = {
      hoTen: 'Nguyễn Văn A',
      ngaySinh: '01/01/2000',
      thuongTru: { tinh: 'Hà Nội', xa: 'Tây Hồ' },
      giaDinh: [{ hoTen: 'Con A', tuoi: 5 }],
    };
    const blob = encryptJson(KEY, obj);
    const result = decryptJson<typeof obj>(KEY, blob);
    expect(result).toEqual(obj);
  });

  it('throw khi key sai kích thước', async () => {
    const { encrypt } = await import('./aes.js');
    const badKey = Buffer.alloc(16);
    expect(() => encrypt(badKey, 'x')).toThrow();
  });
});

describe('crypto/kms', () => {
  it('deriveCitizenKey: deterministic cùng input → cùng key', async () => {
    const { deriveCitizenKey } = await import('./kms.js');
    const hash = 'a'.repeat(64);
    const salt = Buffer.alloc(32, 5);
    const k1 = await deriveCitizenKey(hash, salt);
    const k2 = await deriveCitizenKey(hash, salt);
    expect(k1.equals(k2)).toBe(true);
    expect(k1).toHaveLength(32);
  });

  it('deriveCitizenKey: salt khác → key khác', async () => {
    const { deriveCitizenKey, generateSalt } = await import('./kms.js');
    const hash = 'b'.repeat(64);
    const k1 = await deriveCitizenKey(hash, generateSalt());
    const k2 = await deriveCitizenKey(hash, generateSalt());
    expect(k1.equals(k2)).toBe(false);
  }, 30_000); // Argon2id chậm — timeout 30s

  it('deriveCitizenKey: citizen khác → key khác', async () => {
    const { deriveCitizenKey } = await import('./kms.js');
    const salt = Buffer.alloc(32, 6);
    const k1 = await deriveCitizenKey('a'.repeat(64), salt);
    const k2 = await deriveCitizenKey('b'.repeat(64), salt);
    expect(k1.equals(k2)).toBe(false);
  }, 30_000);

  it('throw với hash invalid', async () => {
    const { deriveCitizenKey } = await import('./kms.js');
    const salt = Buffer.alloc(32);
    await expect(deriveCitizenKey('too-short', salt)).rejects.toThrow();
  });

  it('throw với salt quá nhỏ', async () => {
    const { deriveCitizenKey } = await import('./kms.js');
    await expect(
      deriveCitizenKey('a'.repeat(64), Buffer.alloc(8)),
    ).rejects.toThrow();
  });

  it('generateSalt: 32 bytes random', async () => {
    const { generateSalt } = await import('./kms.js');
    const a = generateSalt();
    const b = generateSalt();
    expect(a).toHaveLength(32);
    expect(a.equals(b)).toBe(false); // random khác nhau
  });
});

describe('end-to-end: encrypt PII vault như real flow', () => {
  it('hash CCCD → derive key → encrypt PII → decrypt lấy lại', async () => {
    const { hashCccd } = await import('./hash.js');
    const { deriveCitizenKey, generateSalt } = await import('./kms.js');
    const { encryptJson, decryptJson } = await import('./aes.js');

    // 1. Nhận CCCD number từ NFC scan
    const cccdNumber = '012345678901';

    // 2. Hash để lookup citizen
    const citizenHash = hashCccd(cccdNumber);

    // 3. Derive key với fresh salt cho snapshot mới
    const salt = generateSalt();
    const key = await deriveCitizenKey(citizenHash, salt);

    // 4. Encrypt full PII payload
    const piiPayload = {
      hoTen: 'Nguyễn Văn A',
      cccd: cccdNumber,
      ngaySinh: '01/01/2000',
      gioiTinh: 'Nam',
      thuongTru: {
        tinh: 'Hà Nội',
        huyen: 'Tây Hồ',
        diaChi: 'Ngọc Khánh',
      },
      gpLx: {
        soGplx: 'B1-123456',
        ngayCap: '2020-01-01',
      },
      giaDinh: [
        { hoTen: 'Con A', quanHe: 'con', tuoi: 5 },
        { hoTen: 'Vợ B', quanHe: 'vợ', tuoi: 30 },
      ],
    };
    const vault = encryptJson(key, piiPayload);

    // 5. Store {ciphertext, iv, authTag, salt} vào DB — KHÔNG store key

    // 6. Sau 2 ngày user quay lại → hash lại CCCD → lookup citizen → get salt từ DB
    // → derive lại key → decrypt vault
    const keyAgain = await deriveCitizenKey(citizenHash, salt);
    const restored = decryptJson<typeof piiPayload>(keyAgain, vault);

    expect(restored).toEqual(piiPayload);
    expect(restored.giaDinh[0].hoTen).toBe('Con A');
  }, 60_000);
});
