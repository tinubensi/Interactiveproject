/**
 * Permission Resolver - Core permission matching and inheritance logic
 */

import { getRolesByIds } from './roleRepository';

/**
 * Check if a granted permission matches a requested permission
 * 
 * @param requested - The permission being checked (e.g., 'customers:read')
 * @param granted - A permission the user has (e.g., 'customers:*' or 'customers:read:own')
 * @returns Object with match result and any scope restriction
 */
export function matchesPermission(
  requested: string,
  granted: string
): { matches: boolean; scope?: string } {
  // Wildcard match - super admin
  if (granted === '*:*') {
    return { matches: true };
  }

  // Exact match
  if (granted === requested) {
    return { matches: true };
  }

  const [grantedResource, grantedAction, grantedScope] = granted.split(':');
  const [requestedResource, requestedAction] = requested.split(':');

  // Category wildcard (e.g., 'customers:*' matches 'customers:read')
  if (grantedResource === requestedResource && grantedAction === '*') {
    return { matches: true, scope: grantedScope };
  }

  // Scoped permission (e.g., 'customers:read:own' grants 'customers:read' but needs resource check)
  if (grantedResource === requestedResource && grantedAction === requestedAction && grantedScope) {
    return { matches: true, scope: grantedScope };
  }

  return { matches: false };
}

/**
 * Check if a user has a specific permission
 * 
 * @param userPermissions - Array of permissions the user has
 * @param requested - The permission to check
 * @returns Object with authorization result
 */
export function hasPermission(
  userPermissions: string[],
  requested: string
): { authorized: boolean; matchedPermission?: string; scope?: string } {
  for (const granted of userPermissions) {
    const result = matchesPermission(requested, granted);
    if (result.matches) {
      return {
        authorized: true,
        matchedPermission: granted,
        scope: result.scope,
      };
    }
  }

  return { authorized: false };
}

/**
 * Compute effective permissions from direct permissions and inherited roles
 * 
 * @param directPermissions - Permissions directly assigned to the role
 * @param inheritsFrom - Array of parent role IDs
 * @returns Array of all effective permissions (deduplicated)
 */
export async function computeEffectivePermissions(
  directPermissions: string[],
  inheritsFrom?: string[]
): Promise<string[]> {
  const allPermissions = new Set<string>(directPermissions);

  if (inheritsFrom && inheritsFrom.length > 0) {
    // Get parent roles
    const parentRoles = await getRolesByIds(inheritsFrom);
    
    // Recursively compute permissions from parent roles
    for (const parent of parentRoles) {
      const parentPermissions = await computeEffectivePermissions(
        parent.permissions,
        parent.inheritsFrom
      );
      parentPermissions.forEach((p) => allPermissions.add(p));
    }
  }

  return Array.from(allPermissions).sort();
}

/**
 * Compute effective permissions for a user based on their roles
 * 
 * @param roleIds - Array of role IDs assigned to the user
 * @returns Array of all effective permissions
 */
export async function computeUserPermissions(roleIds: string[]): Promise<string[]> {
  if (roleIds.length === 0) {
    return [];
  }

  const roles = await getRolesByIds(roleIds);
  const allPermissions = new Set<string>();

  for (const role of roles) {
    const rolePermissions = await computeEffectivePermissions(
      role.permissions,
      role.inheritsFrom
    );
    rolePermissions.forEach((p) => allPermissions.add(p));
  }

  return Array.from(allPermissions).sort();
}

/**
 * Check if a permission is a wildcard permission
 */
export function isWildcardPermission(permission: string): boolean {
  return permission === '*:*' || permission.endsWith(':*');
}

/**
 * Check if a permission has a scope restriction
 */
export function hasScope(permission: string): boolean {
  const parts = permission.split(':');
  return parts.length === 3;
}

/**
 * Extract scope from a permission
 */
export function getScope(permission: string): string | undefined {
  const parts = permission.split(':');
  return parts.length === 3 ? parts[2] : undefined;
}

/**
 * Get the base permission without scope
 */
export function getBasePermission(permission: string): string {
  const parts = permission.split(':');
  return parts.slice(0, 2).join(':');
}

/**
 * Check if user has any of the required permissions
 */
export function hasAnyPermission(
  userPermissions: string[],
  requiredPermissions: string[]
): { authorized: boolean; matchedPermission?: string } {
  for (const required of requiredPermissions) {
    const result = hasPermission(userPermissions, required);
    if (result.authorized) {
      return { authorized: true, matchedPermission: result.matchedPermission };
    }
  }
  return { authorized: false };
}

/**
 * Check if user has all required permissions
 */
export function hasAllPermissions(
  userPermissions: string[],
  requiredPermissions: string[]
): { authorized: boolean; missingPermissions: string[] } {
  const missing: string[] = [];
  
  for (const required of requiredPermissions) {
    const result = hasPermission(userPermissions, required);
    if (!result.authorized) {
      missing.push(required);
    }
  }

  return {
    authorized: missing.length === 0,
    missingPermissions: missing,
  };
}

