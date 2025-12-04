/**
 * Authentication utilities for Policy Service
 * Wraps the shared auth middleware
 */

import { HttpRequest } from '@azure/functions';
import {
  requireAuth as sharedRequireAuth,
  requirePermission as sharedRequirePermission,
  AuthError,
  ForbiddenError,
} from '@nectaria/auth-middleware';
import { UserContext } from '@nectaria/shared-types';

// Re-export error classes and types
export { AuthError, ForbiddenError };
export type { UserContext };

/**
 * Ensure request is authorized - throws if not authenticated
 */
export async function ensureAuthorized(request: HttpRequest): Promise<UserContext> {
  return sharedRequireAuth(request);
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
 * Permission constants for policy operations
 */
export const POLICY_PERMISSIONS = {
  POLICIES_CREATE: 'policies:create',
  POLICIES_READ: 'policies:read',
  POLICIES_UPDATE: 'policies:update',
  POLICIES_DELETE: 'policies:delete',
  POLICIES_ENDORSE: 'policies:endorse',
} as const;

