/**
 * Token Service for Quotation Service
 * Handles generation and validation of quotation selection tokens
 */

import { randomBytes } from 'crypto';

class TokenService {
  /**
   * Generate a secure random token for quotation selection
   * Format: 32-character hex string
   */
  generateSelectionToken(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Validate token format
   * Tokens should be 32-character hex strings
   */
  isValidTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }
    // Check if it's a 32-character hex string
    return /^[0-9a-f]{32}$/i.test(token);
  }

  /**
   * Check if a token has already been used
   * A token is considered used if tokenUsedAt is set
   */
  isTokenUsed(tokenUsedAt: Date | null | undefined): boolean {
    return tokenUsedAt !== null && tokenUsedAt !== undefined;
  }
}

export const tokenService = new TokenService();
