/**
 * Authentication utilities for Workflow Service
 * TODO: Implement real authentication when auth service is ready
 */

import { HttpRequest } from '@azure/functions';

// Local type definitions
export interface UserContext {
  userId: string;
  email: string;
  name?: string;
  roles: string[];
  permissions?: string[];
  azureAdGroups?: string[];
  organizationId?: string;
  sessionId?: string;
  authMethod?: 'b2b_sso' | 'b2c_password' | 'b2c_otp';
  territories?: string[];
  teamId?: string;
}

// Local error classes
export class AuthError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = 'Access forbidden', public permission?: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

// Re-export error classes with legacy names for compatibility
export { AuthError as AuthorizationError };

// Mock user for development
const MOCK_USER: UserContext = {
  userId: 'dev-user',
  email: 'dev@nectaria.com',
  name: 'Dev User',
  roles: ['junior-broker'],
  azureAdGroups: [],
  organizationId: 'dev-org',
  sessionId: 'dev-session'
};

/**
 * Extract user context from request (async version)
 */
export async function extractUserContext(request: HttpRequest): Promise<UserContext | null> {
  // TODO: Implement real authentication when auth service is ready
  return MOCK_USER;
}

/**
 * Ensure request is authorized - throws if not authenticated
 */
export async function ensureAuthorized(request: HttpRequest): Promise<UserContext> {
  // TODO: Implement real authentication when auth service is ready
  return MOCK_USER;
}

/**
 * Check if user has a specific permission
 */
export async function checkPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  // TODO: Implement real permission checking when auth service is ready
  return true;
}

/**
 * Require a specific permission - throws ForbiddenError if not authorized
 */
export async function requirePermission(
  userId: string,
  permission: string
): Promise<void> {
  // TODO: Implement real permission checking when auth service is ready
}

/**
 * Legacy role check - for backwards compatibility
 */
export async function ensureRole(
  userContext: UserContext,
  requiredRoles: string[]
): Promise<void> {
  // TODO: Implement real role checking when auth service is ready
  // No-op for now
}

/**
 * Legacy organization check - for backwards compatibility
 */
export function ensureOrganization(
  userContext: UserContext,
  organizationId: string
): void {
  // TODO: Implement real organization checking when auth service is ready
  // No-op for now
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
