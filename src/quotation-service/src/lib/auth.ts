/**
 * Authentication utilities for Quotation Service
 * Wraps the shared auth middleware
 */

import { HttpRequest } from '@azure/functions';
import {
  extractUserContext as sharedExtractUserContext,
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
 * Permission constants for quotation operations
 */
export const QUOTATION_PERMISSIONS = {
  QUOTES_CREATE: 'quotes:create',
  QUOTES_READ: 'quotes:read',
  QUOTES_UPDATE: 'quotes:update',
  QUOTES_DELETE: 'quotes:delete',
  QUOTES_APPROVE: 'quotes:approve',
} as const;

