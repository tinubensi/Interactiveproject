/**
 * Azure AD Group to Role Mapper
 */

import { AZURE_AD_GROUP_MAPPING } from '@nectaria/shared-types';

/**
 * Map Azure AD groups to application roles
 */
export function mapGroupsToRoles(azureAdGroups: string[]): string[] {
  const roles: string[] = [];

  for (const group of azureAdGroups) {
    const role = AZURE_AD_GROUP_MAPPING[group];
    if (role && !roles.includes(role)) {
      roles.push(role);
    }
  }

  return roles.sort();
}

/**
 * Get the Azure AD group mapping
 */
export function getGroupMapping(): Record<string, string> {
  return { ...AZURE_AD_GROUP_MAPPING };
}

/**
 * Check if an Azure AD group is mapped to a role
 */
export function isGroupMapped(groupName: string): boolean {
  return groupName in AZURE_AD_GROUP_MAPPING;
}

/**
 * Get the role for an Azure AD group
 */
export function getRoleForGroup(groupName: string): string | undefined {
  return AZURE_AD_GROUP_MAPPING[groupName];
}

/**
 * Get the Azure AD group for a role
 */
export function getGroupForRole(roleId: string): string | undefined {
  for (const [group, role] of Object.entries(AZURE_AD_GROUP_MAPPING)) {
    if (role === roleId) {
      return group;
    }
  }
  return undefined;
}

/**
 * Calculate role changes between previous and current Azure AD groups
 */
export function calculateRoleChanges(
  previousGroups: string[],
  currentGroups: string[]
): {
  previousRoles: string[];
  currentRoles: string[];
  rolesAdded: string[];
  rolesRemoved: string[];
} {
  const previousRoles = mapGroupsToRoles(previousGroups);
  const currentRoles = mapGroupsToRoles(currentGroups);

  const rolesAdded = currentRoles.filter((r) => !previousRoles.includes(r));
  const rolesRemoved = previousRoles.filter((r) => !currentRoles.includes(r));

  return {
    previousRoles,
    currentRoles,
    rolesAdded,
    rolesRemoved,
  };
}

/**
 * Validate if all groups in the array are known
 */
export function validateGroups(groups: string[]): {
  valid: string[];
  unknown: string[];
} {
  const valid: string[] = [];
  const unknown: string[] = [];

  for (const group of groups) {
    if (isGroupMapped(group)) {
      valid.push(group);
    } else {
      unknown.push(group);
    }
  }

  return { valid, unknown };
}

