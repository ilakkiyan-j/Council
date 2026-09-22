import crypto from 'crypto';

/**
 * AES-256-GCM Authenticated Encryption Service
 * Used for zero-leakage storage of Bring-Your-Own-Key (BYOK) provider credentials.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // Standard 128 bits authentication tag

/**
 * Resolves the 32-byte master encryption key from environment.
 * If not set or invalid length, derives a stable 32-byte key via scrypt.
 */
function getMasterKey(): Buffer {
  const rawKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'council-v2-fallback-secret-key-32b!';
  if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }
  // Deterministic 32-byte key derivation using salt
  return crypto.scryptSync(rawKey, 'council-byok-credential-salt-v2', 32);
}

export interface EncryptedPayload {
  encryptedSecret: string;
  iv: string;
  authTag: string;
  keyFingerprint: string;
  maskedDisplay: string;
}

/**
 * Encrypts a raw provider API key using AES-256-GCM.
 * Never logs or retains the plaintext key.
 */
export function encryptCredential(plaintextKey: string): EncryptedPayload {
  const trimmed = plaintextKey.trim();
  if (!trimmed) {
    throw new Error('Cannot encrypt an empty credential.');
  }

  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(trimmed, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  // Generate non-reversible fingerprint using SHA-256
  const keyFingerprint = crypto.createHash('sha256').update(trimmed).digest('hex');

  // Format safe masked display (e.g. ••••••••••••9X2A)
  const lastFour = trimmed.length > 4 ? trimmed.slice(-4) : trimmed;
  const maskedDisplay = `••••••••••••${lastFour}`;

  return {
    encryptedSecret: encrypted,
    iv: iv.toString('hex'),
    authTag,
    keyFingerprint,
    maskedDisplay,
  };
}

/**
 * Decrypts an encrypted credential immediately prior to an AI provider call.
 * Authenticates the ciphertext using the stored GCM authTag.
 */
export function decryptCredential(encryptedSecret: string, ivHex: string, authTagHex: string): string {
  try {
    const key = getMasterKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedSecret, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err: any) {
    throw new Error('Decryption failed: Credential could not be authenticated or decrypted.');
  }
}

/**
 * Generates a non-reversible SHA-256 fingerprint for a raw key.
 */
export function generateKeyFingerprint(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey.trim()).digest('hex');
}

/**
 * Generates a masked representation of a secret.
 */
export function maskKey(rawKey: string): string {
  const trimmed = rawKey.trim();
  const lastFour = trimmed.length > 4 ? trimmed.slice(-4) : trimmed;
  return `••••••••••••${lastFour}`;
}
