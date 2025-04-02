import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

// Only run this check on the server side
if (typeof window === 'undefined') {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is required for encryption/decryption');
  }
}

// Convert the hex string key to a buffer - only on server side
const KEY = typeof window === 'undefined' ? Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex') : null;

/**
 * Server-side only encryption function
 */
export function encrypt(text: string): string {
  if (typeof window !== 'undefined') {
    throw new Error('Encryption can only be performed on the server side');
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, KEY!, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Combine IV, encrypted text, and auth tag
  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

/**
 * Server-side only decryption function
 */
export function decrypt(text: string): string {
  if (typeof window !== 'undefined') {
    throw new Error('Decryption can only be performed on the server side');
  }

  const [ivHex, encrypted, authTagHex] = text.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = createDecipheriv(ALGORITHM, KEY!, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
} 