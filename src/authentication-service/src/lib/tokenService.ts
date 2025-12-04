/**
 * Token Service - JWT generation and validation
 */

import jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'crypto';
import type { AccessTokenPayload, RefreshTokenPayload } from '../models/TokenPayload';

/**
 * Token configuration
 */
export interface TokenConfig {
  jwtSecret: string;
  accessTokenLifetime: number; // seconds
  refreshTokenLifetime: number; // seconds
  issuer: string;
}

/**
 * User data for token generation
 */
export interface TokenUserData {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  azureAdGroups: string[];
  organizationId: string;
  sessionId: string;
}

/**
 * Generate access token JWT
 */
export function generateAccessToken(user: TokenUserData, config: TokenConfig): string {
  const now = Math.floor(Date.now() / 1000);
  
  const payload: AccessTokenPayload = {
    sub: user.userId,
    email: user.email,
    name: user.name,
    roles: user.roles,
    groups: user.azureAdGroups,
    orgId: user.organizationId,
    sid: user.sessionId,
    iat: now,
    exp: now + config.accessTokenLifetime,
    iss: config.issuer,
  };
  
  return jwt.sign(payload, config.jwtSecret, { algorithm: 'HS256' });
}

/**
 * Generate refresh token JWT
 * 
 * @param userId - User ID
 * @param sessionId - Session ID
 * @param config - Token configuration
 * @param existingFamily - Optional existing family for rotation (will generate new one anyway)
 */
export function generateRefreshToken(
  userId: string,
  sessionId: string,
  config: TokenConfig,
  existingFamily?: string
): string {
  const now = Math.floor(Date.now() / 1000);
  
  // Always generate a new family ID for security
  // The family is used to detect token reuse attacks
  const family = randomUUID();
  
  const payload: RefreshTokenPayload = {
    sub: userId,
    sid: sessionId,
    fam: family,
    iat: now,
    exp: now + config.refreshTokenLifetime,
    iss: config.issuer,
  };
  
  return jwt.sign(payload, config.jwtSecret, { algorithm: 'HS256' });
}

/**
 * Verify and decode access token
 * Returns null if token is invalid or expired
 */
export function verifyAccessToken(
  token: string,
  config: TokenConfig
): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
      issuer: config.issuer,
    }) as AccessTokenPayload;
    
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Verify and decode refresh token
 * Returns null if token is invalid or expired
 */
export function verifyRefreshToken(
  token: string,
  config: TokenConfig
): RefreshTokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
      issuer: config.issuer,
    }) as RefreshTokenPayload;
    
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Decode token without verification (for debugging)
 * WARNING: Do not use for authentication
 */
export function decodeToken(token: string): AccessTokenPayload | RefreshTokenPayload | null {
  try {
    return jwt.decode(token) as AccessTokenPayload | RefreshTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Hash token using SHA-256 for secure storage
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Check if token hash matches
 */
export function verifyTokenHash(token: string, hash: string): boolean {
  const computedHash = hashToken(token);
  
  // Use timing-safe comparison
  if (computedHash.length !== hash.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < computedHash.length; i++) {
    result |= computedHash.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Extract token family from refresh token
 */
export function getTokenFamily(token: string, config: TokenConfig): string | null {
  const decoded = verifyRefreshToken(token, config);
  return decoded?.fam || null;
}

