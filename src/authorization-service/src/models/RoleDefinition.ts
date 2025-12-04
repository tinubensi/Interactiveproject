/**
 * Role Definition - stored in Cosmos DB role-definitions container
 * Partition Key: /roleId
 */
export interface RoleDefinitionDocument {
  /** Document ID (UUID) */
  id: string;
  
  /** Role identifier (kebab-case, e.g., 'senior-broker') - Partition key */
  roleId: string;
  
  /** Human-readable name */
  displayName: string;
  
  /** Description of the role */
  description: string;
  
  /** Granted permissions (e.g., ['customers:read', 'quotes:approve']) */
  permissions: string[];
  
  /** Mapped Azure AD group name */
  azureAdGroup?: string;
  
  /** Parent role IDs for inheritance */
  inheritsFrom?: string[];
  
  /** System role - cannot be deleted */
  isSystem: boolean;
  
  /** High privilege role - requires approval to assign */
  isHighPrivilege: boolean;
  
  /** Whether the role is active */
  isActive: boolean;
  
  /** Created timestamp (ISO 8601) */
  createdAt: string;
  
  /** Created by user ID */
  createdBy: string;
  
  /** Last updated timestamp (ISO 8601) */
  updatedAt?: string;
  
  /** Updated by user ID */
  updatedBy?: string;
}

/**
 * Request body for creating a role
 */
export interface CreateRoleRequest {
  roleId: string;
  displayName: string;
  description: string;
  permissions: string[];
  azureAdGroup?: string;
  inheritsFrom?: string[];
  isHighPrivilege?: boolean;
}

/**
 * Request body for updating a role
 */
export interface UpdateRoleRequest {
  displayName?: string;
  description?: string;
  permissions?: string[];
  azureAdGroup?: string;
  inheritsFrom?: string[];
  isHighPrivilege?: boolean;
  isActive?: boolean;
}

/**
 * Response for role operations
 */
export interface RoleResponse {
  id: string;
  roleId: string;
  displayName: string;
  description: string;
  permissions: string[];
  /** Effective permissions including inherited ones */
  effectivePermissions: string[];
  azureAdGroup?: string;
  inheritsFrom?: string[];
  isSystem: boolean;
  isHighPrivilege: boolean;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

