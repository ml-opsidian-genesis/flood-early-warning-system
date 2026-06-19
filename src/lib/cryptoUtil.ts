import crypto from 'node:crypto';

// Configuration constants
const ALGORITHM = 'aes-256-cbc';
// Retrieve encryption key from environment (must be 32 bytes for AES-256)
const KEY_STRING = process.env.MSG_ENCRYPTION_KEY;
if (!KEY_STRING) {
  throw new Error('MSG_ENCRYPTION_KEY is not defined in .env');
}
// Derive a 32-byte key using SHA-256 hash (ensures correct length)
const KEY = crypto.createHash('sha256').update(KEY_STRING).digest();
const IV_LENGTH = 16; // 128-bit IV for AES

/**
 * Encrypts a plain text string.
 * Returns a single string formatted as "ivHex:cipherHex".
 */
export function encrypt(plainText: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  // Concatenate IV and ciphertext with a colon separator
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypts a string produced by {@link encrypt}.
 * Expects the format "ivHex:cipherHex".
 */
export function decrypt(encryptedText: string): string {
  const [ivHex, cipherHex] = encryptedText.split(':');
  if (!ivHex || !cipherHex) {
    throw new Error('Invalid encrypted text format');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
