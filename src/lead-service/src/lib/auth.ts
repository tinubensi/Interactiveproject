/**
 * Authentication utilities for Lead Service
 * Wraps the shared auth middleware
 */

import { HttpRequest } from '@azure/functions';
import {
  extractUserContext as sharedExtractUserContext,
  requireAuth as sharedRequireAuth,
  checkPermission as sharedCheckPermission,
  requirePermission as sharedRequirePermission,
  AuthError,
  ForbiddenError,
} from '@nectaria/auth-middleware';
import { UserContext } from '@nectaria/shared-types';

// Re-export error classes and types
export { AuthError, ForbiddenError };
export type { UserContext };

/**
 * Extract user context from request (async)
 */
export async function extractUserContext(request: HttpRequest): Promise<UserContext | null> {
  try {
    return await sharedExtractUserContext(request);
  } catch {
    return null;
  }
}

/**
 * Ensure request is authorized - throws if not authenticated
 */
export async function ensureAuthorized(request: HttpRequest): Promise<UserContext> {
  return sharedRequireAuth(request);
}

/**
 * Check if user has a specific permission
 */
export async function checkPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  return sharedCheckPermission(userId, permission);
}

/**
 * Require a specific permission - throws ForbiddenError if not authorized
 */
export async function requirePermission(
  userId: string,
  permission: string
): Promise<void> {
  return sharedRequirePermission(userId, permission);
}

/**
 * Validate internal service key for event handlers
 */
export function validateServiceKey(request: HttpRequest): void {
  const serviceKey = request.headers.get('x-service-key');
  const expectedKey = process.env.INTERNAL_SERVICE_KEY;
  
  if (!expectedKey) {
    console.warn('INTERNAL_SERVICE_KEY not configured - skipping validation');
    return;
  }
  
  if (serviceKey !== expectedKey) {
    throw new AuthError('Invalid service key');
  }
}

/**
 * Permission constants for lead operations
 */
export const LEAD_PERMISSIONS = {
  LEADS_CREATE: 'leads:create',
  LEADS_READ: 'leads:read',
  LEADS_READ_OWN: 'leads:read:own',
  LEADS_UPDATE: 'leads:update',
  LEADS_UPDATE_OWN: 'leads:update:own',
  LEADS_DELETE: 'leads:delete',
} as const;

