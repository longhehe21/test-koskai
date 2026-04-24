export { hashCccd, verifyCccdHash } from './hash.js';
export {
  encrypt,
  decrypt,
  encryptJson,
  decryptJson,
  type EncryptedBlob,
} from './aes.js';
export {
  deriveCitizenKey,
  generateSalt,
  wipeBuffer,
  CURRENT_ENCRYPTION_VERSION,
  CURRENT_KDF_ALGORITHM,
  CURRENT_CIPHER_ALGORITHM,
  DEFAULT_SALT_LENGTH,
} from './kms.js';
