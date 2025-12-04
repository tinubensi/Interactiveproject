/**
 * Session Repository - Cosmos DB operations for sessions
 */

import { Container } from '@azure/cosmos';
import { v4 as uuidv4 } from 'uuid';
import UAParser from 'ua-parser-js';
import { getCosmosClient } from './cosmosClient';
import { getConfig } from './config';
import { hashToken } from './tokenService';
import type { Session, CreateSessionInput, SessionInfo } from '../models/Session';

/**
 * Get sessions container
 */
function getSessionsContainer(): Container {
  const config = getConfig();
  const client = getCosmosClient();
  return client
    .database(config.cosmos.databaseId)
    .container(config.cosmos.containers.sessions);
}

/**
 * Parse device info from user agent
 */
function parseDeviceInfo(userAgent: string): string {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  
  const browser = result.browser.name || 'Unknown Browser';
  const os = result.os.name || 'Unknown OS';
  
  return `${browser} on ${os}`;
}

/**
 * Create a new session
 */
export async function createSession(
  input: CreateSessionInput,
  accessToken: string,
  refreshToken: string,
  refreshTokenFamily: string
): Promise<Session> {
  const container = getSessionsContainer();
  const config = getConfig();
  
  const sessionId = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.tokens.refreshTokenLifetime * 1000);
  
  const session: Session = {
    id: sessionId,
    sessionId,
    userId: input.userId,
    email: input.email,
    name: input.name,
    authMethod: input.authMethod,
    azureAdGroups: input.azureAdGroups,
    organizationId: input.organizationId,
    accessTokenHash: hashToken(accessToken),
    refreshTokenHash: hashToken(refreshToken),
    refreshTokenFamily,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    deviceInfo: parseDeviceInfo(input.userAgent),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastActivityAt: now.toISOString(),
    ttl: config.tokens.refreshTokenLifetime,
  };
  
  await container.items.create(session);
  
  return session;
}

/**
 * Get session by ID
 */
export async function getSessionById(
  sessionId: string,
  userId: string
): Promise<Session | null> {
  const container = getSessionsContainer();
  
  try {
    const { resource } = await container.item(sessionId, userId).read<Session>();
    return resource || null;
  } catch (error: any) {
    if (error.code === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Get session by access token hash
 */
export async function getSessionByAccessToken(accessToken: string): Promise<Session | null> {
  const container = getSessionsContainer();
  const tokenHash = hashToken(accessToken);
  
  const query = {
    query: 'SELECT * FROM c WHERE c.accessTokenHash = @tokenHash',
    parameters: [{ name: '@tokenHash', value: tokenHash }],
  };
  
  const { resources } = await container.items.query<Session>(query).fetchAll();
  return resources[0] || null;
}

/**
 * Get session by refresh token hash
 */
export async function getSessionByRefreshToken(refreshToken: string): Promise<Session | null> {
  const container = getSessionsContainer();
  const tokenHash = hashToken(refreshToken);
  
  const query = {
    query: 'SELECT * FROM c WHERE c.refreshTokenHash = @tokenHash',
    parameters: [{ name: '@tokenHash', value: tokenHash }],
  };
  
  const { resources } = await container.items.query<Session>(query).fetchAll();
  return resources[0] || null;
}

/**
 * Get all active sessions for a user
 */
export async function getSessionsByUserId(userId: string): Promise<Session[]> {
  const container = getSessionsContainer();
  
  const query = {
    query: 'SELECT * FROM c WHERE c.userId = @userId ORDER BY c.lastActivityAt DESC',
    parameters: [{ name: '@userId', value: userId }],
  };
  
  const { resources } = await container.items.query<Session>(query).fetchAll();
  return resources;
}

/**
 * Update session tokens (for token refresh)
 */
export async function updateSessionTokens(
  sessionId: string,
  userId: string,
  accessToken: string,
  refreshToken: string,
  newRefreshTokenFamily: string
): Promise<Session | null> {
  const container = getSessionsContainer();
  const config = getConfig();
  
  const session = await getSessionById(sessionId, userId);
  if (!session) {
    return null;
  }
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.tokens.refreshTokenLifetime * 1000);
  
  const updatedSession: Session = {
    ...session,
    accessTokenHash: hashToken(accessToken),
    refreshTokenHash: hashToken(refreshToken),
    refreshTokenFamily: newRefreshTokenFamily,
    lastActivityAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    ttl: config.tokens.refreshTokenLifetime,
  };
  
  await container.item(sessionId, userId).replace(updatedSession);
  
  return updatedSession;
}

/**
 * Update session last activity
 */
export async function updateSessionActivity(
  sessionId: string,
  userId: string
): Promise<void> {
  const container = getSessionsContainer();
  
  const session = await getSessionById(sessionId, userId);
  if (!session) {
    return;
  }
  
  const now = new Date();
  const updatedSession: Session = {
    ...session,
    lastActivityAt: now.toISOString(),
  };
  
  await container.item(sessionId, userId).replace(updatedSession);
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string, userId: string): Promise<boolean> {
  const container = getSessionsContainer();
  
  try {
    await container.item(sessionId, userId).delete();
    return true;
  } catch (error: any) {
    if (error.code === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Delete all sessions for a user
 */
export async function deleteAllUserSessions(userId: string): Promise<number> {
  const sessions = await getSessionsByUserId(userId);
  
  let deletedCount = 0;
  for (const session of sessions) {
    const deleted = await deleteSession(session.sessionId, userId);
    if (deleted) {
      deletedCount++;
    }
  }
  
  return deletedCount;
}

/**
 * Check if refresh token family is valid (for reuse detection)
 */
export async function verifyRefreshTokenFamily(
  sessionId: string,
  userId: string,
  family: string
): Promise<{ valid: boolean; session?: Session }> {
  const session = await getSessionById(sessionId, userId);
  
  if (!session) {
    return { valid: false };
  }
  
  if (session.refreshTokenFamily !== family) {
    // Token reuse detected - family doesn't match
    return { valid: false, session };
  }
  
  return { valid: true, session };
}

/**
 * Convert session to client-safe session info
 */
export function toSessionInfo(session: Session, currentSessionId: string): SessionInfo {
  return {
    id: session.sessionId,
    deviceInfo: session.deviceInfo,
    ipAddress: session.ipAddress,
    createdAt: session.createdAt,
    lastActivityAt: session.lastActivityAt,
    isCurrent: session.sessionId === currentSessionId,
  };
}

