/**
 * Session model for Cosmos DB storage
 * Container: sessions
 * Partition Key: /userId
 * TTL: 30 days (2592000 seconds)
 */

export interface Session {
  id: string;                    // Session UUID
  sessionId: string;             // Same as id, for queries
  userId: string;                // Partition key

  // User Info
  email: string;
  name: string;

  // Authentication
  authMethod: AuthMethod;
  azureAdGroups: string[];       // From ID token
  organizationId: string;

  // Tokens (hashed for security)
  accessTokenHash: string;       // SHA-256 hash
  refreshTokenHash: string;      // SHA-256 hash
  refreshTokenFamily: string;    // For rotation detection

  // Context
  ipAddress: string;
  userAgent: string;
  deviceInfo: string;            // Parsed from user agent

  // Timestamps
  createdAt: string;             // ISO 8601
  expiresAt: string;             // ISO 8601
  lastActivityAt: string;        // ISO 8601

  // Cosmos DB TTL
  ttl: number;                   // 30 days = 2592000 seconds
  _ts?: number;                  // Cosmos DB timestamp
}

export type AuthMethod = 'b2b_sso' | 'b2c_password' | 'b2c_otp';

/**
 * Session response (safe to return to client)
 */
export interface SessionInfo {
  id: string;
  deviceInfo: string;
  ipAddress: string;
  createdAt: string;
  lastActivityAt: string;
  isCurrent: boolean;
}

/**
 * Create session input
 */
export interface CreateSessionInput {
  userId: string;
  email: string;
  name: string;
  authMethod: AuthMethod;
  azureAdGroups: string[];
  organizationId: string;
  ipAddress: string;
  userAgent: string;
}

