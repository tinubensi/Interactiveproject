"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserFromRequest = exports.createTestToken = exports.ensureOrganization = exports.ensureRole = exports.ensureAuthorized = exports.extractUserContext = exports.AuthorizationError = void 0;
class AuthorizationError extends Error {
    constructor(message = 'Unauthorized') {
        super(message);
        this.name = 'AuthorizationError';
    }
}
exports.AuthorizationError = AuthorizationError;
const extractUserContext = (request) => {
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
            const userContext = JSON.parse(decoded);
            return userContext;
        }
        catch {
            // Token is not a test token, would validate with Azure AD B2C in production
            return null;
        }
    }
    return null;
};
exports.extractUserContext = extractUserContext;
const ensureAuthorized = (request) => {
    const userContext = (0, exports.extractUserContext)(request);
    if (!userContext) {
        throw new AuthorizationError('Valid authorization token is required');
    }
    return userContext;
};
exports.ensureAuthorized = ensureAuthorized;
const ensureRole = (userContext, requiredRoles) => {
    const hasRole = requiredRoles.some((role) => userContext.roles.includes(role));
    if (!hasRole) {
        throw new AuthorizationError(`Access denied. Required roles: ${requiredRoles.join(', ')}`);
    }
};
exports.ensureRole = ensureRole;
const ensureOrganization = (userContext, organizationId) => {
    if (userContext.organizationId &&
        userContext.organizationId !== organizationId) {
        throw new AuthorizationError('Access denied to this organization');
    }
};
exports.ensureOrganization = ensureOrganization;
const createTestToken = (userContext) => {
    const json = JSON.stringify(userContext);
    return Buffer.from(json).toString('base64');
};
exports.createTestToken = createTestToken;
/**
 * Get user from request with fallback to anonymous user
 */
const getUserFromRequest = (request) => {
    const userContext = (0, exports.extractUserContext)(request);
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
exports.getUserFromRequest = getUserFromRequest;
//# sourceMappingURL=auth.js.map