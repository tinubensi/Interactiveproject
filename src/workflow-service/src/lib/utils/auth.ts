import { HttpRequest } from '@azure/functions';

export class AuthorizationError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export interface UserContext {
  userId: string;
  email?: string;
  roles: string[];
  organizationId?: string;
}

export const extractUserContext = (request: HttpRequest): UserContext | null => {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    return null;
  }

  // For development/testing, support a simple bearer token format
  // In production, this would validate JWT tokens from Azure AD B2C
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    
    // For testing purposes, parse a base64-encoded JSON user context
    // Format: Bearer base64({ userId, email, roles, organizationId })
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const userContext = JSON.parse(decoded) as UserContext;
      return userContext;
    } catch {
      // Token is not a test token, would validate with Azure AD B2C in production
      return null;
    }
  }

  return null;
};

export const ensureAuthorized = (request: HttpRequest): UserContext => {
  const userContext = extractUserContext(request);
  
  if (!userContext) {
    throw new AuthorizationError('Valid authorization token is required');
  }
  
  return userContext;
};

export const ensureRole = (
  userContext: UserContext,
  requiredRoles: string[]
): void => {
  const hasRole = requiredRoles.some((role) =>
    userContext.roles.includes(role)
  );
  
  if (!hasRole) {
    throw new AuthorizationError(
      `Access denied. Required roles: ${requiredRoles.join(', ')}`
    );
  }
};

export const ensureOrganization = (
  userContext: UserContext,
  organizationId: string
): void => {
  if (
    userContext.organizationId &&
    userContext.organizationId !== organizationId
  ) {
    throw new AuthorizationError('Access denied to this organization');
  }
};

export const createTestToken = (userContext: UserContext): string => {
  const json = JSON.stringify(userContext);
  return Buffer.from(json).toString('base64');
};

/**
 * Get user from request with fallback to anonymous user
 */
export const getUserFromRequest = (
  request: HttpRequest
): UserContext & { userName?: string } => {
  const userContext = extractUserContext(request);
  
  if (userContext) {
    return {
      ...userContext,
      userName: userContext.email || userContext.userId
    };
  }
  
  // Return anonymous user for unauthenticated requests
  return {
    userId: 'anonymous',
    roles: [],
    userName: 'Anonymous User'
  };
};

