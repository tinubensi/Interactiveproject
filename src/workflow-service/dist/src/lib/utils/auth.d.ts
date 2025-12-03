import { HttpRequest } from '@azure/functions';
export declare class AuthorizationError extends Error {
    constructor(message?: string);
}
export interface UserContext {
    userId: string;
    email?: string;
    roles: string[];
    organizationId?: string;
}
export declare const extractUserContext: (request: HttpRequest) => UserContext | null;
export declare const ensureAuthorized: (request: HttpRequest) => UserContext;
export declare const ensureRole: (userContext: UserContext, requiredRoles: string[]) => void;
export declare const ensureOrganization: (userContext: UserContext, organizationId: string) => void;
export declare const createTestToken: (userContext: UserContext) => string;
/**
 * Get user from request with fallback to anonymous user
 */
export declare const getUserFromRequest: (request: HttpRequest) => UserContext & {
    userName?: string;
};
//# sourceMappingURL=auth.d.ts.map