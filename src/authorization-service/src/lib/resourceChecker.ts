/**
 * Resource Checker - Resource-level permission checking with scopes
 */

import { ResourceContext } from '../models/PermissionCache';

/**
 * User scope context for resource checking
 */
export interface UserScopeContext {
  userId: string;
  teamId?: string;
  territory?: string[];
}

/**
 * Scope hierarchy (higher value = broader access)
 */
export const SCOPE_HIERARCHY: Record<string, number> = {
  '': 4,           // Full access (no scope)
  'territory': 3,  // Territory-based access
  'team': 2,       // Team-based access
  'own': 1,        // Owner-based access
  'self': 0,       // Self-only access (for customers)
};

/**
 * Check if a user with a scoped permission can access a specific resource
 * 
 * @param scope - The permission scope (e.g., 'own', 'team', 'territory')
 * @param user - User's scope context
 * @param resource - Resource being accessed
 * @returns Object with authorization result and reason
 */
export function checkResourceScope(
  scope: string | undefined,
  user: UserScopeContext,
  resource: ResourceContext
): { authorized: boolean; reason: string } {
  // No scope = full access
  if (!scope) {
    return { authorized: true, reason: 'full_access' };
  }

  switch (scope) {
    case 'own':
      // User must be the owner of the resource
      if (resource.ownerId === user.userId) {
        return { authorized: true, reason: 'owner_match' };
      }
      return { authorized: false, reason: 'not_owner' };

    case 'team':
      // User must be in the same team as the resource
      if (user.teamId && resource.teamId === user.teamId) {
        return { authorized: true, reason: 'team_match' };
      }
      return { authorized: false, reason: 'not_in_team' };

    case 'territory':
      // Resource must be in one of the user's territories
      if (user.territory && resource.territory && user.territory.includes(resource.territory)) {
        return { authorized: true, reason: 'territory_match' };
      }
      return { authorized: false, reason: 'not_in_territory' };

    case 'self':
      // Resource ID must match user ID (for customer self-service)
      if (resource.id === user.userId) {
        return { authorized: true, reason: 'self_match' };
      }
      return { authorized: false, reason: 'not_self' };

    case 'medical':
      // Special scope for medical documents - needs additional validation
      // For now, just allow if the user has this scope
      return { authorized: true, reason: 'medical_access' };

    default:
      return { authorized: false, reason: `unknown_scope: ${scope}` };
  }
}

/**
 * Check if a user can access a resource with any of their scoped permissions
 * 
 * @param scopes - Array of scopes from matched permissions
 * @param user - User's scope context  
 * @param resource - Resource being accessed
 * @returns Object with authorization result and matched scope
 */
export function checkResourceWithScopes(
  scopes: (string | undefined)[],
  user: UserScopeContext,
  resource: ResourceContext
): { authorized: boolean; matchedScope?: string; reason: string } {
  // Sort scopes by hierarchy (broader access first)
  const sortedScopes = scopes.sort((a, b) => {
    const aLevel = SCOPE_HIERARCHY[a || ''] ?? -1;
    const bLevel = SCOPE_HIERARCHY[b || ''] ?? -1;
    return bLevel - aLevel;
  });

  for (const scope of sortedScopes) {
    const result = checkResourceScope(scope, user, resource);
    if (result.authorized) {
      return {
        authorized: true,
        matchedScope: scope || undefined,
        reason: result.reason,
      };
    }
  }

  return {
    authorized: false,
    reason: 'no_matching_scope',
  };
}

/**
 * Check if user has full (unscoped) access
 */
export function hasFullAccess(permissions: string[], requestedPermission: string): boolean {
  const [requestedResource, requestedAction] = requestedPermission.split(':');

  for (const perm of permissions) {
    // Super admin has full access
    if (perm === '*:*') {
      return true;
    }

    const [grantedResource, grantedAction, grantedScope] = perm.split(':');

    // No scope on matching permission = full access
    if (grantedResource === requestedResource) {
      if (grantedAction === '*' && !grantedScope) {
        return true;
      }
      if (grantedAction === requestedAction && !grantedScope) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get all matching scopes for a permission from user's permission set
 */
export function getMatchingScopes(
  permissions: string[],
  requestedPermission: string
): (string | undefined)[] {
  const [requestedResource, requestedAction] = requestedPermission.split(':');
  const scopes: (string | undefined)[] = [];

  for (const perm of permissions) {
    if (perm === '*:*') {
      scopes.push(undefined); // Super admin = no scope restriction
      continue;
    }

    const [grantedResource, grantedAction, grantedScope] = perm.split(':');

    if (grantedResource === requestedResource) {
      if (grantedAction === '*') {
        scopes.push(grantedScope);
      } else if (grantedAction === requestedAction) {
        scopes.push(grantedScope);
      }
    }
  }

  return scopes;
}

/**
 * Determine the broadest scope a user has for a permission
 */
export function getBroadestScope(
  permissions: string[],
  requestedPermission: string
): { scope: string | undefined; level: number } {
  const scopes = getMatchingScopes(permissions, requestedPermission);
  
  if (scopes.length === 0) {
    return { scope: undefined, level: -1 };
  }

  let broadestScope: string | undefined = scopes[0];
  let highestLevel = SCOPE_HIERARCHY[broadestScope || ''] ?? -1;

  for (const scope of scopes) {
    const level = SCOPE_HIERARCHY[scope || ''] ?? -1;
    if (level > highestLevel) {
      highestLevel = level;
      broadestScope = scope;
    }
  }

  return { scope: broadestScope, level: highestLevel };
}

