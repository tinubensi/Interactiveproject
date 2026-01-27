import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

/**
 * Token Service
 * Generates and validates secure tokens for customer quotation review links
 */
class TokenService {
  /**
   * Generate a secure unique token for quotation review
   * Combines UUID with random bytes for extra security
   */
  generateSelectionToken(): string {
    const uuid = uuidv4().replace(/-/g, '');
    const randomBytes = crypto.randomBytes(8).toString('hex');
    return `${uuid}${randomBytes}`;
  }

  /**
   * Validate token format
   * Token should be 48 characters (32 from UUID + 16 from random bytes)
   */
  isValidTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }
    // Token should be alphanumeric and 48 characters long
    return /^[a-f0-9]{48}$/.test(token);
  }

  /**
   * Check if token has been used
   * Returns true if tokenUsedAt is set
   */
  isTokenUsed(tokenUsedAt?: Date): boolean {
    return tokenUsedAt !== undefined && tokenUsedAt !== null;
  }
}

export const tokenService = new TokenService();

