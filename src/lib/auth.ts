import crypto from 'crypto';

const SECRET = process.env.ENCRYPTION_KEY || 'default_super_secret_dev_encryption_key_propsathi';

/**
 * Hashes a plaintext password using OWASP-compliant Scrypt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Compares a plaintext password against a stored Scrypt hash.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const newHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(newHash, 'hex'));
}

/**
 * Generates a signed, URL-safe Base64 session token.
 */
export function signToken(payload: any, expiresInSeconds = 86400): string {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  const data = JSON.stringify({ ...payload, expiresAt });
  const base64Data = Buffer.from(data).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(base64Data)
    .digest('base64url');
    
  return `${base64Data}.${signature}`;
}

/**
 * Validates a signed session token signature and checks for expiration.
 */
export function verifyToken(token: string): any {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  
  const [base64Data, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', SECRET)
    .update(base64Data)
    .digest('base64url');
    
  if (signature !== expectedSignature) return null;
  
  try {
    const data = JSON.parse(Buffer.from(base64Data, 'base64url').toString('utf8'));
    if (data.expiresAt < Date.now()) return null; // Expired
    return data;
  } catch {
    return null;
  }
}
