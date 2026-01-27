/**
 * Authorization utilities for Quotation Service
 */

import { HttpRequest } from '@azure/functions';

export const QUOTATION_PERMISSIONS = {
  QUOTATIONS_READ: 'quotations:read',
  QUOTATIONS_CREATE: 'quotations:create',
  QUOTATIONS_UPDATE: 'quotations:update',
  QUOTATIONS_DELETE: 'quotations:delete',
  QUOTATIONS_SEND: 'quotations:send',
} as const;

interface UserContext {
  userId: string;
  email?: string;
  permissions?: string[];
}

/**
 * Ensure the request is authorized
 * For now, this is a placeholder that allows all requests
 * TODO: Implement proper authentication/authorization
 */
export async function ensureAuthorized(request: HttpRequest): Promise<UserContext> {
  // TODO: Implement proper JWT token validation
  // For now, return a default user context
  const authHeader = request.headers.get('authorization');
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // In a real implementation, validate the JWT token here
    // For now, extract a user ID from the token or use a default
    return {
      userId: 'system',
      email: 'system@example.com',
      permissions: Object.values(QUOTATION_PERMISSIONS),
    };
  }

  // Allow anonymous access for now (can be restricted later)
  return {
    userId: 'anonymous',
    permissions: [],
  };
}

/**
 * Require a specific permission
 * Throws an error if the user doesn't have the permission
 */
export async function requirePermission(userId: string, permission: string): Promise<void> {
  // TODO: Implement proper permission checking
  // For now, allow all requests (development mode)
  if (userId === 'anonymous' && process.env.NODE_ENV === 'production') {
    throw new Error(`Permission denied: ${permission}`);
  }
  // In development, allow all requests
}
