/**
 * LoginAttempt model for rate limiting
 * Container: login-attempts
 * Partition Key: /email
 * TTL: 15 minutes (900 seconds)
 */

export interface LoginAttempt {
  id: string;
  email: string;                 // Partition key
  attempts: number;              // Failed attempt count
  lastAttemptAt: string;         // ISO 8601
  lockedUntil?: string;          // ISO 8601 (if locked)
  ipAddresses: string[];         // Track IPs
  ttl: number;                   // 15 minutes = 900 seconds
}

/**
 * Rate limit configuration
 */
export const RATE_LIMIT_CONFIG = {
  maxAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes in ms
  ttlSeconds: 900, // 15 minutes
} as const;

/**
 * Check if user is locked out
 */
export function isLockedOut(attempt: LoginAttempt | null): boolean {
  if (!attempt) return false;
  if (!attempt.lockedUntil) return false;
  return new Date(attempt.lockedUntil) > new Date();
}

/**
 * Check if should lock out
 */
export function shouldLockout(attempts: number): boolean {
  return attempts >= RATE_LIMIT_CONFIG.maxAttempts;
}

