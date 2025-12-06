/**
 * User Role Repository - Manage user role assignments
 */

import { v4 as uuidv4 } from 'uuid';
import { getUserRolesContainer } from './cosmosClient';
import { 
  UserRoleDocument, 
  TemporaryPermission 
} from '../models/UserRole';
import { computeUserPermissions } from './permissionResolver';
import { getRoleById } from './roleRepository';
import { invalidateCacheForUser } from './cacheRepository';

/**
 * Get user role document by user ID
 */
export async function getUserRoles(userId: string): Promise<UserRoleDocument | null> {
  const container = getUserRolesContainer();
  
  try {
    const { resource } = await container.item(userId, userId).read<UserRoleDocument>();
    return resource || null;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Create a new user role document
 */
export async function createUserRoles(
  userId: string,
  email: string,
  organizationId: string,
  options?: {
    roles?: string[];
    azureAdGroups?: string[];
    territory?: string[];
    teamId?: string;
    source?: 'azure_ad' | 'manual';
  }
): Promise<UserRoleDocument> {
  const roles = options?.roles || [];
  const effectivePermissions = await computeUserPermissions(roles);
  const now = new Date().toISOString();

  const document: UserRoleDocument = {
    id: userId,
    userId,
    email,
    roles,
    effectivePermissions,
    azureAdGroups: options?.azureAdGroups || [],
    organizationId,
    territory: options?.territory,
    teamId: options?.teamId,
    temporaryPermissions: [],
    source: options?.source || 'manual',
    syncedAt: options?.source === 'azure_ad' ? now : undefined,
    createdAt: now,
    updatedAt: now,
  };

  const container = getUserRolesContainer();
  const { resource } = await container.items.create(document);

  if (!resource) {
    throw new Error('Failed to create user roles');
  }

  return resource;
}

/**
 * Assign a role to a user
 */
export async function assignRole(
  userId: string,
  roleId: string,
  assignedBy: string
): Promise<{
  userRoles: UserRoleDocument;
  approvalRequired: boolean;
  approvalId?: string;
}> {
  // Verify role exists
  const role = await getRoleById(roleId);
  if (!role) {
    throw new Error(`Role "${roleId}" not found.`);
  }
  if (!role.isActive) {
    throw new Error(`Role "${roleId}" is not active.`);
  }

  // Check if high-privilege role requires approval
  if (role.isHighPrivilege) {
    // TODO: Create workflow approval request
    const approvalId = uuidv4();
    const userRoles = await getUserRoles(userId);
    if (!userRoles) {
      throw new Error(`User "${userId}" not found.`);
    }
    return {
      userRoles,
      approvalRequired: true,
      approvalId,
    };
  }

  // Get or create user roles document
  let userRoles = await getUserRoles(userId);
  if (!userRoles) {
    throw new Error(`User "${userId}" not found. Create user roles first.`);
  }

  // Check if already assigned
  if (userRoles.roles.includes(roleId)) {
    return { userRoles, approvalRequired: false };
  }

  // Add role
  const updatedRoles = [...userRoles.roles, roleId];
  const effectivePermissions = await computeUserPermissions(updatedRoles);

  const updated: UserRoleDocument = {
    ...userRoles,
    roles: updatedRoles,
    effectivePermissions,
    source: 'manual',
    updatedAt: new Date().toISOString(),
  };

  const container = getUserRolesContainer();
  const { resource } = await container.item(userId, userId).replace(updated);

  if (!resource) {
    throw new Error('Failed to assign role');
  }

  // Invalidate permission cache
  await invalidateCacheForUser(userId);

  return { userRoles: resource, approvalRequired: false };
}

/**
 * Remove a role from a user
 */
export async function removeRole(
  userId: string,
  roleId: string,
  removedBy: string
): Promise<UserRoleDocument> {
  const userRoles = await getUserRoles(userId);
  if (!userRoles) {
    throw new Error(`User "${userId}" not found.`);
  }

  // Check if role is assigned
  if (!userRoles.roles.includes(roleId)) {
    throw new Error(`User "${userId}" does not have role "${roleId}".`);
  }

  // Remove role
  const updatedRoles = userRoles.roles.filter((r) => r !== roleId);
  const effectivePermissions = await computeUserPermissions(updatedRoles);

  const updated: UserRoleDocument = {
    ...userRoles,
    roles: updatedRoles,
    effectivePermissions,
    source: 'manual',
    updatedAt: new Date().toISOString(),
  };

  const container = getUserRolesContainer();
  const { resource } = await container.item(userId, userId).replace(updated);

  if (!resource) {
    throw new Error('Failed to remove role');
  }

  // Invalidate permission cache
  await invalidateCacheForUser(userId);

  return resource;
}

/**
 * Update user roles from Azure AD groups
 */
export async function syncFromAzureAd(
  userId: string,
  email: string,
  azureAdGroups: string[],
  groupToRoleMapping: Record<string, string>,
  organizationId: string
): Promise<{
  previousRoles: string[];
  currentRoles: string[];
  rolesAdded: string[];
  rolesRemoved: string[];
}> {
  // Map Azure AD groups to roles
  const mappedRoles = azureAdGroups
    .map((group) => groupToRoleMapping[group])
    .filter((role): role is string => !!role);

  // Get current user roles
  let userRoles = await getUserRoles(userId);
  const previousRoles = userRoles?.roles || [];

  // Calculate changes
  const rolesAdded = mappedRoles.filter((r) => !previousRoles.includes(r));
  const rolesRemoved = previousRoles.filter((r) => !mappedRoles.includes(r));

  // Compute effective permissions
  const effectivePermissions = await computeUserPermissions(mappedRoles);
  const now = new Date().toISOString();

  if (userRoles) {
    // Update existing
    const updated: UserRoleDocument = {
      ...userRoles,
      email,
      roles: mappedRoles,
      effectivePermissions,
      azureAdGroups,
      source: 'azure_ad',
      syncedAt: now,
      updatedAt: now,
    };

    const container = getUserRolesContainer();
    await container.item(userId, userId).replace(updated);
  } else {
    // Create new
    await createUserRoles(userId, email, organizationId, {
      roles: mappedRoles,
      azureAdGroups,
      source: 'azure_ad',
    });
  }

  // Invalidate permission cache
  await invalidateCacheForUser(userId);

  return {
    previousRoles,
    currentRoles: mappedRoles,
    rolesAdded,
    rolesRemoved,
  };
}

/**
 * Grant a temporary permission to a user
 */
export async function grantTempPermission(
  userId: string,
  permission: string,
  grantedBy: string,
  reason: string,
  validFrom: string,
  validUntil: string
): Promise<TemporaryPermission> {
  // Validate permission is not wildcard
  if (permission === '*:*') {
    throw new Error('Cannot grant wildcard (*:*) permission temporarily.');
  }

  // Validate dates
  const now = new Date();
  const until = new Date(validUntil);
  const maxDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  if (until <= now) {
    throw new Error('validUntil must be in the future.');
  }
  if (until > maxDate) {
    throw new Error('Temporary permissions cannot exceed 30 days.');
  }

  const userRoles = await getUserRoles(userId);
  if (!userRoles) {
    throw new Error(`User "${userId}" not found.`);
  }

  const tempPermission: TemporaryPermission = {
    id: uuidv4(),
    permission,
    grantedBy,
    reason,
    validFrom: validFrom || now.toISOString(),
    validUntil,
    createdAt: now.toISOString(),
  };

  const updated: UserRoleDocument = {
    ...userRoles,
    temporaryPermissions: [...userRoles.temporaryPermissions, tempPermission],
    updatedAt: now.toISOString(),
  };

  const container = getUserRolesContainer();
  await container.item(userId, userId).replace(updated);

  // Invalidate permission cache
  await invalidateCacheForUser(userId);

  return tempPermission;
}

/**
 * Revoke a temporary permission
 */
export async function revokeTempPermission(
  userId: string,
  permissionId: string,
  revokedBy: string
): Promise<void> {
  const userRoles = await getUserRoles(userId);
  if (!userRoles) {
    throw new Error(`User "${userId}" not found.`);
  }

  const tempPerm = userRoles.temporaryPermissions.find((p) => p.id === permissionId);
  if (!tempPerm) {
    throw new Error(`Temporary permission "${permissionId}" not found.`);
  }

  const updated: UserRoleDocument = {
    ...userRoles,
    temporaryPermissions: userRoles.temporaryPermissions.filter((p) => p.id !== permissionId),
    updatedAt: new Date().toISOString(),
  };

  const container = getUserRolesContainer();
  await container.item(userId, userId).replace(updated);

  // Invalidate permission cache
  await invalidateCacheForUser(userId);
}

/**
 * Get active temporary permissions for a user
 */
export function getActiveTempPermissions(userRoles: UserRoleDocument): TemporaryPermission[] {
  const now = new Date();
  return userRoles.temporaryPermissions.filter((p) => {
    const validFrom = new Date(p.validFrom);
    const validUntil = new Date(p.validUntil);
    return validFrom <= now && validUntil > now;
  });
}

/**
 * Get all permissions for a user including temporary ones
 */
export function getAllUserPermissions(userRoles: UserRoleDocument): string[] {
  const activeTempPerms = getActiveTempPermissions(userRoles);
  const tempPermStrings = activeTempPerms.map((p) => p.permission);
  
  return [...new Set([...userRoles.effectivePermissions, ...tempPermStrings])].sort();
}

/**
 * Update user scope context (territory, team)
 */
export async function updateUserScope(
  userId: string,
  updates: {
    territory?: string[];
    teamId?: string;
    organizationId?: string;
  }
): Promise<UserRoleDocument> {
  const userRoles = await getUserRoles(userId);
  if (!userRoles) {
    throw new Error(`User "${userId}" not found.`);
  }

  const updated: UserRoleDocument = {
    ...userRoles,
    territory: updates.territory ?? userRoles.territory,
    teamId: updates.teamId ?? userRoles.teamId,
    organizationId: updates.organizationId ?? userRoles.organizationId,
    updatedAt: new Date().toISOString(),
  };

  const container = getUserRolesContainer();
  const { resource } = await container.item(userId, userId).replace(updated);

  if (!resource) {
    throw new Error('Failed to update user scope');
  }

  // Invalidate cache since scope affects resource access
  await invalidateCacheForUser(userId);

  return resource;
}

