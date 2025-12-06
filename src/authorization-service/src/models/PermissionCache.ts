/**
 * Permission Cache Entry - stored in Cosmos DB permission-cache container
 * Partition Key: /userId
 * TTL: 300 seconds (5 minutes)
 */
export interface PermissionCacheDocument {
  /** Document ID (UUID) */
  id: string;
  
  /** Cache key: `${userId}:${permission}:${resourceId?}` */
  cacheKey: string;
  
  /** User ID - Partition key */
  userId: string;
  
  /** Requested permission */
  permission: string;
  
  /** Resource ID (for resource-level checks) */
  resourceId?: string;
  
  /** Resource type (for resource-level checks) */
  resourceType?: string;
  
  /** Authorization result */
  authorized: boolean;
  
  /** Reason for denial (if unauthorized) */
  reason?: string;
  
  /** Which permission granted access (if authorized) */
  matchedPermission?: string;
  
  /** Matched scope (e.g., ':own', ':team') */
  matchedScope?: string;
  
  /** When this entry was cached (ISO 8601) */
  cachedAt: string;
  
  /** TTL in seconds for Cosmos DB auto-deletion */
  ttl: number;
}

/**
 * Request body for permission check
 */
export interface CheckPermissionRequest {
  userId: string;
  permission: string;
}

/**
 * Response for permission check
 */
export interface CheckPermissionResponse {
  authorized: boolean;
  userId: string;
  roles?: string[];
  matchedPermission?: string;
  reason?: string;
  required?: string;
  userPermissions?: string[];
}

/**
 * Resource context for resource-level permission checks
 */
export interface ResourceContext {
  type: string;
  id: string;
  ownerId?: string;
  territory?: string;
  teamId?: string;
}

/**
 * Request body for resource permission check
 */
export interface CheckResourcePermissionRequest {
  userId: string;
  permission: string;
  resource: ResourceContext;
}

/**
 * Response for resource permission check
 */
export interface CheckResourcePermissionResponse {
  authorized: boolean;
  reason?: string;
  matchedScope?: string;
  matchedPermission?: string;
}

