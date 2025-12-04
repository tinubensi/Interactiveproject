/**
 * Role Repository - CRUD operations for role definitions
 */

import { v4 as uuidv4 } from 'uuid';
import { getRolesContainer } from './cosmosClient';
import { 
  RoleDefinitionDocument, 
  CreateRoleRequest, 
  UpdateRoleRequest,
  RoleResponse 
} from '../models/RoleDefinition';
import { computeEffectivePermissions } from './permissionResolver';

/**
 * Reserved role IDs that cannot be used for custom roles
 */
export const RESERVED_ROLE_IDS = [
  'super-admin',
  'compliance-officer',
  'broker-manager',
  'senior-broker',
  'junior-broker',
  'underwriter',
  'customer-support',
  'customer',
];

/**
 * Validate role ID format (kebab-case)
 */
export function isValidRoleId(roleId: string): boolean {
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(roleId);
}

/**
 * Validate permission format (resource:action[:scope])
 */
export function isValidPermission(permission: string): boolean {
  return /^[a-z]+:[a-z*]+(:[a-z]+)?$/.test(permission);
}

/**
 * Create a new role
 */
export async function createRole(
  request: CreateRoleRequest,
  createdBy: string
): Promise<RoleResponse> {
  // Validate role ID format
  if (!isValidRoleId(request.roleId)) {
    throw new Error(`Invalid role ID format: ${request.roleId}. Must be kebab-case.`);
  }

  // Check if reserved
  if (RESERVED_ROLE_IDS.includes(request.roleId)) {
    throw new Error(`Role ID "${request.roleId}" is reserved for system roles.`);
  }

  // Validate permissions
  for (const perm of request.permissions) {
    if (!isValidPermission(perm)) {
      throw new Error(`Invalid permission format: ${perm}`);
    }
  }

  // Check if role already exists
  const existing = await getRoleById(request.roleId);
  if (existing) {
    throw new Error(`Role with ID "${request.roleId}" already exists.`);
  }

  // Validate inheritsFrom roles exist
  if (request.inheritsFrom && request.inheritsFrom.length > 0) {
    for (const parentId of request.inheritsFrom) {
      const parent = await getRoleById(parentId);
      if (!parent) {
        throw new Error(`Parent role "${parentId}" does not exist.`);
      }
    }
  }

  const now = new Date().toISOString();
  const document: RoleDefinitionDocument = {
    id: uuidv4(),
    roleId: request.roleId,
    displayName: request.displayName,
    description: request.description,
    permissions: request.permissions,
    azureAdGroup: request.azureAdGroup,
    inheritsFrom: request.inheritsFrom,
    isSystem: false,
    isHighPrivilege: request.isHighPrivilege ?? false,
    isActive: true,
    createdAt: now,
    createdBy,
  };

  const container = getRolesContainer();
  const { resource } = await container.items.create(document);

  if (!resource) {
    throw new Error('Failed to create role');
  }

  // Compute effective permissions
  const effectivePermissions = await computeEffectivePermissions(resource.permissions, resource.inheritsFrom);

  return toRoleResponse(resource, effectivePermissions);
}

/**
 * Get role by ID
 */
export async function getRoleById(roleId: string): Promise<RoleDefinitionDocument | null> {
  const container = getRolesContainer();
  
  try {
    const { resource } = await container.item(roleId, roleId).read<RoleDefinitionDocument>();
    return resource || null;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Get role with effective permissions
 */
export async function getRoleWithEffectivePermissions(roleId: string): Promise<RoleResponse | null> {
  const role = await getRoleById(roleId);
  if (!role) {
    return null;
  }

  const effectivePermissions = await computeEffectivePermissions(role.permissions, role.inheritsFrom);
  return toRoleResponse(role, effectivePermissions);
}

/**
 * List all roles
 */
export async function listRoles(options?: {
  activeOnly?: boolean;
  includeSystem?: boolean;
}): Promise<RoleResponse[]> {
  const container = getRolesContainer();
  
  let query = 'SELECT * FROM c WHERE 1=1';
  const parameters: { name: string; value: string | number | boolean }[] = [];

  if (options?.activeOnly !== false) {
    query += ' AND c.isActive = @isActive';
    parameters.push({ name: '@isActive', value: true });
  }

  if (options?.includeSystem === false) {
    query += ' AND c.isSystem = @isSystem';
    parameters.push({ name: '@isSystem', value: false });
  }

  query += ' ORDER BY c.displayName';

  const { resources } = await container.items.query<RoleDefinitionDocument>({
    query,
    parameters,
  }).fetchAll();

  // Compute effective permissions for each role
  const results: RoleResponse[] = [];
  for (const role of resources) {
    const effectivePermissions = await computeEffectivePermissions(role.permissions, role.inheritsFrom);
    results.push(toRoleResponse(role, effectivePermissions));
  }

  return results;
}

/**
 * Update a role
 */
export async function updateRole(
  roleId: string,
  updates: UpdateRoleRequest,
  updatedBy: string
): Promise<RoleResponse> {
  const existing = await getRoleById(roleId);
  if (!existing) {
    throw new Error(`Role "${roleId}" not found.`);
  }

  // Validate permissions if provided
  if (updates.permissions) {
    for (const perm of updates.permissions) {
      if (!isValidPermission(perm)) {
        throw new Error(`Invalid permission format: ${perm}`);
      }
    }
  }

  // Validate inheritsFrom roles exist
  if (updates.inheritsFrom && updates.inheritsFrom.length > 0) {
    for (const parentId of updates.inheritsFrom) {
      if (parentId === roleId) {
        throw new Error('Role cannot inherit from itself.');
      }
      const parent = await getRoleById(parentId);
      if (!parent) {
        throw new Error(`Parent role "${parentId}" does not exist.`);
      }
    }
  }

  const updated: RoleDefinitionDocument = {
    ...existing,
    displayName: updates.displayName ?? existing.displayName,
    description: updates.description ?? existing.description,
    permissions: updates.permissions ?? existing.permissions,
    azureAdGroup: updates.azureAdGroup ?? existing.azureAdGroup,
    inheritsFrom: updates.inheritsFrom ?? existing.inheritsFrom,
    isHighPrivilege: updates.isHighPrivilege ?? existing.isHighPrivilege,
    isActive: updates.isActive ?? existing.isActive,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  const container = getRolesContainer();
  const { resource } = await container.item(roleId, roleId).replace(updated);

  if (!resource) {
    throw new Error('Failed to update role');
  }

  const effectivePermissions = await computeEffectivePermissions(resource.permissions, resource.inheritsFrom);
  return toRoleResponse(resource, effectivePermissions);
}

/**
 * Delete a role (soft delete by setting isActive = false)
 */
export async function deleteRole(roleId: string, deletedBy: string): Promise<void> {
  const existing = await getRoleById(roleId);
  if (!existing) {
    throw new Error(`Role "${roleId}" not found.`);
  }

  if (existing.isSystem) {
    throw new Error(`Cannot delete system role "${roleId}".`);
  }

  const updated: RoleDefinitionDocument = {
    ...existing,
    isActive: false,
    updatedAt: new Date().toISOString(),
    updatedBy: deletedBy,
  };

  const container = getRolesContainer();
  await container.item(roleId, roleId).replace(updated);
}

/**
 * Get multiple roles by IDs
 */
export async function getRolesByIds(roleIds: string[]): Promise<RoleDefinitionDocument[]> {
  if (roleIds.length === 0) {
    return [];
  }

  const container = getRolesContainer();
  const placeholders = roleIds.map((_, i) => `@id${i}`).join(', ');
  const parameters = roleIds.map((id, i) => ({ name: `@id${i}`, value: id }));

  const { resources } = await container.items.query<RoleDefinitionDocument>({
    query: `SELECT * FROM c WHERE c.roleId IN (${placeholders}) AND c.isActive = true`,
    parameters,
  }).fetchAll();

  return resources;
}

/**
 * Convert document to response
 */
function toRoleResponse(doc: RoleDefinitionDocument, effectivePermissions: string[]): RoleResponse {
  return {
    id: doc.id,
    roleId: doc.roleId,
    displayName: doc.displayName,
    description: doc.description,
    permissions: doc.permissions,
    effectivePermissions,
    azureAdGroup: doc.azureAdGroup,
    inheritsFrom: doc.inheritsFrom,
    isSystem: doc.isSystem,
    isHighPrivilege: doc.isHighPrivilege,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
    createdBy: doc.createdBy,
    updatedAt: doc.updatedAt,
    updatedBy: doc.updatedBy,
  };
}

