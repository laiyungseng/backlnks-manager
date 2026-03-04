import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const ENCODING = 'hex';

/**
 * Derives a 32-byte AES key from ENCRYPTION_SECRET using SHA-256.
 * The user-facing description is "SHA256 encryption" —
 * technically SHA256 is used for key derivation, AES-256-GCM for the cipher.
 */
function getKey() {
    const secret = process.env.ENCRYPTION_SECRET || 'df-app-internal-secret-v1';
    return crypto.createHash('sha256').update(String(secret)).digest();
}

/**
 * Encrypts plaintext using AES-256-GCM (SHA256 key derivation).
 * Returns a single string: iv:authTag:ciphertext  (all hex-encoded)
 */
export function encryptCredential(plaintext) {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
        cipher.update(String(plaintext), 'utf8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString(ENCODING)}:${authTag.toString(ENCODING)}:${encrypted.toString(ENCODING)}`;
}

/**
 * Decrypts a string produced by encryptCredential().
 */
export function decryptCredential(encryptedText) {
    const key = getKey();
    const parts = encryptedText.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted credential format.');

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, ENCODING);
    const authTag = Buffer.from(authTagHex, ENCODING);
    const encryptedBuffer = Buffer.from(encryptedHex, ENCODING);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
    return decrypted.toString('utf8');
}
