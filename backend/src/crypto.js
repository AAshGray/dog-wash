const crypto = require('crypto');

// Load encryption key from environment variable
// The ENCRYPTION_KEY must be a 64-character hex string (32 bytes)
const hexKey = process.env.ENCRYPTION_KEY;
if (!hexKey || hexKey.length !== 64) {
  throw new Error('Invalid ENCRYPTION_KEY. Must be a 64-character hexadecimal string (32 bytes).');
}

const ENCRYPTION_KEY = Buffer.from(hexKey, 'hex');
const IV_LENGTH = 16; // For AES-256-CBC, IV is always 16 bytes

/**
 * Encrypts a plaintext string using AES-256-CBC.
 * Returns a colon-separated string: "iv_hex:ciphertext_hex"
 * @param {string} text - The plaintext to encrypt
 * @returns {string} The encrypted representation
 */
function encrypt(text) {
  if (text === null || text === undefined) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an "iv_hex:ciphertext_hex" string using AES-256-CBC.
 * @param {string} encryptedText - The encrypted representation
 * @returns {string} The decrypted plaintext
 */
function decrypt(encryptedText) {
  if (!encryptedText) return null;
  
  const textParts = encryptedText.split(':');
  if (textParts.length !== 2) {
    throw new Error('Invalid encrypted text format. Expected iv:ciphertext');
  }
  
  const iv = Buffer.from(textParts[0], 'hex');
  const encrypted = Buffer.from(textParts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Generates a SHA-256 hash of a trimmed and lowercased email string.
 * Used for secure lookup in the database.
 * @param {string} email - The email to hash
 * @returns {string} The 64-character hex hash
 */
function hashEmail(email) {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

module.exports = {
  encrypt,
  decrypt,
  hashEmail
};
