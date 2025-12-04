/**
 * Authentication utilities for Workflow Service
 * 
 * This module wraps the shared auth middleware for use in workflow handlers.
 * It provides backwards-compatible function signatures while using the new
 * authentication infrastructure.
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

// Re-export error classes with legacy names for compatibility
export { AuthError as AuthorizationError };
export { ForbiddenError };
export type { UserContext };

/**
 * Extract user context from request (async version)
 * Uses shared middleware to validate tokens via Auth Service
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
 * Async version that validates tokens via Auth Service
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
 * Legacy role check - for backwards compatibility
 * Now checks if user has any of the required permissions based on roles
 */
export async function ensureRole(
  userContext: UserContext,
  requiredRoles: string[]
): Promise<void> {
  const hasRole = requiredRoles.some((role) =>
    userContext.roles.includes(role)
  );

  if (!hasRole) {
    throw new ForbiddenError(
      `Access denied. Required roles: ${requiredRoles.join(', ')}`
    );
  }
}

/**
 * Legacy organization check - for backwards compatibility
 */
export function ensureOrganization(
  userContext: UserContext,
  organizationId: string
): void {
  if (
    userContext.organizationId &&
    userContext.organizationId !== organizationId
  ) {
    throw new ForbiddenError('Access denied to this organization');
  }
}

/**
 * Create a test token for development/testing
 * @deprecated Use proper test mocks instead
 */
export function createTestToken(userContext: Partial<UserContext>): string {
  const fullContext: UserContext = {
    userId: userContext.userId || 'test-user',
    email: userContext.email || 'test@nectaria.com',
    roles: userContext.roles || [],
    permissions: userContext.permissions || [],
  };
  const json = JSON.stringify(fullContext);
  return Buffer.from(json).toString('base64');
}

/**
 * Get user from request with fallback to anonymous user
 * Async version
 */
export async function getUserFromRequest(
  request: HttpRequest
): Promise<UserContext & { userName?: string }> {
  try {
    const userContext = await extractUserContext(request);

    if (userContext) {
      return {
        ...userContext,
        userName: userContext.name || userContext.email || userContext.userId,
      };
    }
  } catch {
    // Fall through to anonymous
  }

  // Return anonymous user for unauthenticated requests
  return {
    userId: 'anonymous',
    email: 'anonymous@nectaria.com',
    roles: [],
    permissions: [],
    userName: 'Anonymous User',
  };
}

/**
 * Permission constants for workflow operations
 */
export const WORKFLOW_PERMISSIONS = {
  // Workflow CRUD
  WORKFLOWS_CREATE: 'workflows:create',
  WORKFLOWS_READ: 'workflows:read',
  WORKFLOWS_UPDATE: 'workflows:update',
  WORKFLOWS_DELETE: 'workflows:delete',
  WORKFLOWS_MANAGE: 'workflows:manage',
  WORKFLOWS_EXECUTE: 'workflows:execute',
  
  // Approvals
  APPROVALS_READ: 'approvals:read',
  APPROVALS_DECIDE: 'approvals:decide',
  APPROVALS_REASSIGN: 'approvals:reassign',
} as const;
