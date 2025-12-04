/**
 * User Role Assignment - stored in Cosmos DB user-roles container
 * Partition Key: /userId
 */
export interface UserRoleDocument {
  /** Document ID (UUID) */
  id: string;
  
  /** User ID - Partition key */
  userId: string;
  
  /** User email */
  email: string;
  
  /** Assigned role IDs (e.g., ['senior-broker', 'team-lead']) */
  roles: string[];
  
  /** Computed effective permissions from all roles (cached) */
  effectivePermissions: string[];
  
  /** Original Azure AD groups */
  azureAdGroups: string[];
  
  /** Organization ID for multi-tenant */
  organizationId: string;
  
  /** Territory assignments (for territory-based access) */
  territory?: string[];
  
  /** Team ID (for team-based access) */
  teamId?: string;
  
  /** Temporary permissions */
  temporaryPermissions: TemporaryPermission[];
  
  /** Source of role assignment */
  source: 'azure_ad' | 'manual';
  
  /** Last sync timestamp from Azure AD */
  syncedAt?: string;
  
  /** Created timestamp (ISO 8601) */
  createdAt: string;
  
  /** Last updated timestamp (ISO 8601) */
  updatedAt: string;
}

/**
 * Temporary permission grant
 */
export interface TemporaryPermission {
  /** Unique ID for the temporary permission */
  id: string;
  
  /** Permission string (e.g., 'audit:read') */
  permission: string;
  
  /** User ID who granted this permission */
  grantedBy: string;
  
  /** Reason for granting */
  reason: string;
  
  /** Start of validity period (ISO 8601) */
  validFrom: string;
  
  /** End of validity period (ISO 8601) */
  validUntil: string;
  
  /** Created timestamp (ISO 8601) */
  createdAt: string;
}

/**
 * Request body for assigning a role
 */
export interface AssignRoleRequest {
  roleId: string;
  reason?: string;
}

/**
 * Response for role assignment
 */
export interface AssignRoleResponse {
  success: boolean;
  userId: string;
  roles: string[];
  effectivePermissions: string[];
  /** If high-privilege role requires approval */
  approvalRequired?: boolean;
  approvalId?: string;
  message?: string;
}

/**
 * Request body for Azure AD sync
 */
export interface SyncAzureAdRequest {
  azureAdGroups: string[];
}

/**
 * Response for Azure AD sync
 */
export interface SyncAzureAdResponse {
  userId: string;
  previousRoles: string[];
  currentRoles: string[];
  rolesAdded: string[];
  rolesRemoved: string[];
  syncedAt: string;
}

/**
 * Request body for granting temporary permission
 */
export interface GrantTempPermissionRequest {
  permission: string;
  validFrom?: string;
  validUntil: string;
  reason: string;
}

/**
 * Response for user permissions
 */
export interface UserPermissionsResponse {
  userId: string;
  roles: string[];
  permissions: string[];
  temporaryPermissions: {
    permission: string;
    validUntil: string;
    reason: string;
  }[];
  territory?: string[];
  teamId?: string;
}

