/**
 * Authentication utilities for Form Service
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
 * Extract user context from request (async)
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
 * Permission constants for form operations
 */
export const FORM_PERMISSIONS = {
  // Forms/Templates
  FORMS_CREATE: 'forms:create',
  FORMS_READ: 'forms:read',
  FORMS_UPDATE: 'forms:update',
  FORMS_DELETE: 'forms:delete',
  FORMS_MANAGE: 'forms:manage',
  FORMS_SUBMIT: 'forms:submit',
} as const;
