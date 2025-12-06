/**
 * Authentication utilities for Policy Service
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
 * Ensure request is authorized - throws if not authenticated
 */
export async function ensureAuthorized(request: HttpRequest): Promise<UserContext> {
  // TODO: Implement real authentication when auth service is ready
  return MOCK_USER;
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
 * Permission constants for policy operations
 */
export const POLICY_PERMISSIONS = {
  POLICIES_CREATE: 'policies:create',
  POLICIES_READ: 'policies:read',
  POLICIES_UPDATE: 'policies:update',
  POLICIES_DELETE: 'policies:delete',
  POLICIES_ENDORSE: 'policies:endorse',
} as const;
