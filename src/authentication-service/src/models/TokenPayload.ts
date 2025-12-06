/**
 * JWT Token Payloads
 */

/**
 * Access Token Payload (15 min expiry)
 */
export interface AccessTokenPayload {
  sub: string;          // userId
  email: string;
  name: string;
  roles: string[];      // Mapped from Azure AD groups
  groups: string[];     // Azure AD groups
  orgId: string;        // organizationId
  sid: string;          // sessionId
  iat: number;          // Issued at (unix timestamp)
  exp: number;          // Expiry (unix timestamp)
  iss: string;          // Issuer: 'nectaria-auth'
}

/**
 * Refresh Token Payload (30 day expiry)
 */
export interface RefreshTokenPayload {
  sub: string;          // userId
  sid: string;          // sessionId
  fam: string;          // Token family (for rotation detection)
  iat: number;
  exp: number;
  iss: string;
}

/**
 * Introspect Response
 */
export interface IntrospectResponse {
  active: boolean;
  userId?: string;
  email?: string;
  name?: string;
  roles?: string[];
  azureAdGroups?: string[];
  organizationId?: string;
  sessionId?: string;
  iat?: number;
  exp?: number;
  reason?: 'token_expired' | 'token_invalid' | 'session_revoked';
}

/**
 * User Context (returned from /auth/me)
 */
export interface UserContext {
  id: string;
  email: string;
  name: string;
  azureAdGroups: string[];
  roles: string[];
  organizationId: string;
  authMethod: string;
  sessionId: string;
  lastLogin: string;
}

/**
 * Token configuration
 */
export const TOKEN_CONFIG = {
  accessTokenLifetime: 15 * 60,        // 15 minutes in seconds
  refreshTokenLifetime: 30 * 24 * 60 * 60, // 30 days in seconds
  issuer: 'nectaria-auth',
} as const;

