/**
 * Authentication and Authorization helpers for EMAF Service
 */

import { HttpRequest } from '@azure/functions';

export interface UserContext {
  userId: string;
  email?: string;
  roles?: string[];
}

export const EMAF_PERMISSIONS = {
  EMAF_MANAGE: 'emaf:manage',
  EMAF_VIEW: 'emaf:view',
  EMAF_APPROVE: 'emaf:approve',
  EMAF_CREATE: 'emaf:create',
  EMAF_SUBMIT: 'emaf:submit',
} as const;

/**
 * Ensure request is authorized
 * For now, returns a mock user context
 * In production, validate JWT token
 */
export async function ensureAuthorized(request: HttpRequest): Promise<UserContext> {
  // TODO: Implement JWT validation
  const authHeader = request.headers.get('authorization');
  
  // For development: allow requests without auth header
  // In production, this should throw an error
  if (!authHeader) {
    console.warn('No authorization header provided, using mock user for development');
    return {
      userId: 'dev-user-id',
      email: 'dev@example.com',
      roles: ['admin'],
    };
  }

  // Mock user context for development
  return {
    userId: 'mock-user-id',
    email: 'user@example.com',
    roles: ['admin'],
  };
}

/**
 * Require specific permission
 * For now, always allows
 * In production, check user roles and permissions
 */
export async function requirePermission(userId: string, permission: string): Promise<void> {
  // TODO: Implement permission checking
  // For now, allow all
  return;
}

/**
 * Validate service key for internal service-to-service calls
 */
export function validateServiceKey(request: HttpRequest): boolean {
  const serviceKey = request.headers.get('x-service-key');
  // Updated default to ensure both services use the same key
  const expectedKey = process.env.SERVICE_KEY || 'nectaria-internal-2026';
  
  return serviceKey === expectedKey;
}

/**
 * Extract user ID from request
 */
export function getUserIdFromRequest(request: HttpRequest): string | null {
  // TODO: Extract from JWT token
  return 'mock-user-id';
}
