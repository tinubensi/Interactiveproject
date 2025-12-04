/**
 * Cache Repository - Permission cache operations
 */

import { v4 as uuidv4 } from 'uuid';
import { getCacheContainer } from './cosmosClient';
import { getConfig } from './config';
import { PermissionCacheDocument } from '../models/PermissionCache';

/**
 * Generate a cache key
 */
export function generateCacheKey(
  userId: string,
  permission: string,
  resourceId?: string
): string {
  const parts = [userId, permission];
  if (resourceId) {
    parts.push(resourceId);
  }
  return parts.join(':');
}

/**
 * Get cached permission result
 */
export async function getCachedPermission(
  userId: string,
  permission: string,
  resourceId?: string
): Promise<PermissionCacheDocument | null> {
  const config = getConfig();
  if (!config.cache.enabled) {
    return null;
  }

  const cacheKey = generateCacheKey(userId, permission, resourceId);
  const container = getCacheContainer();

  try {
    const { resources } = await container.items.query<PermissionCacheDocument>({
      query: 'SELECT * FROM c WHERE c.cacheKey = @cacheKey AND c.userId = @userId',
      parameters: [
        { name: '@cacheKey', value: cacheKey },
        { name: '@userId', value: userId },
      ],
    }).fetchAll();

    if (resources.length === 0) {
      return null;
    }

    const cached = resources[0];
    
    // Check if cache is still valid (TTL should handle this, but double-check)
    const cachedAt = new Date(cached.cachedAt);
    const now = new Date();
    const ageSeconds = (now.getTime() - cachedAt.getTime()) / 1000;
    
    if (ageSeconds > cached.ttl) {
      return null;
    }

    return cached;
  } catch (error) {
    console.error('Cache lookup error:', error);
    return null;
  }
}

/**
 * Cache a permission result
 */
export async function cachePermission(
  userId: string,
  permission: string,
  authorized: boolean,
  options?: {
    resourceId?: string;
    resourceType?: string;
    reason?: string;
    matchedPermission?: string;
    matchedScope?: string;
  }
): Promise<void> {
  const config = getConfig();
  if (!config.cache.enabled) {
    return;
  }

  const cacheKey = generateCacheKey(userId, permission, options?.resourceId);
  const now = new Date().toISOString();

  const document: PermissionCacheDocument = {
    id: uuidv4(),
    cacheKey,
    userId,
    permission,
    resourceId: options?.resourceId,
    resourceType: options?.resourceType,
    authorized,
    reason: options?.reason,
    matchedPermission: options?.matchedPermission,
    matchedScope: options?.matchedScope,
    cachedAt: now,
    ttl: config.cache.ttlSeconds,
  };

  const container = getCacheContainer();

  try {
    // Upsert to handle existing cache entries
    await container.items.upsert(document);
  } catch (error) {
    console.error('Cache write error:', error);
    // Don't throw - caching failures shouldn't break authorization
  }
}

/**
 * Invalidate all cache entries for a user
 */
export async function invalidateCacheForUser(userId: string): Promise<number> {
  const container = getCacheContainer();

  try {
    // Find all cache entries for the user
    const { resources } = await container.items.query<PermissionCacheDocument>({
      query: 'SELECT c.id FROM c WHERE c.userId = @userId',
      parameters: [{ name: '@userId', value: userId }],
    }).fetchAll();

    if (resources.length === 0) {
      return 0;
    }

    // Delete each entry
    let deleted = 0;
    for (const entry of resources) {
      try {
        await container.item(entry.id, userId).delete();
        deleted++;
      } catch {
        // Ignore deletion errors
      }
    }

    return deleted;
  } catch (error) {
    console.error('Cache invalidation error:', error);
    return 0;
  }
}

/**
 * Invalidate cache for a specific permission
 */
export async function invalidateCacheForPermission(
  userId: string,
  permission: string
): Promise<void> {
  const container = getCacheContainer();

  try {
    const { resources } = await container.items.query<PermissionCacheDocument>({
      query: 'SELECT c.id FROM c WHERE c.userId = @userId AND c.permission = @permission',
      parameters: [
        { name: '@userId', value: userId },
        { name: '@permission', value: permission },
      ],
    }).fetchAll();

    for (const entry of resources) {
      try {
        await container.item(entry.id, userId).delete();
      } catch {
        // Ignore deletion errors
      }
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
}

/**
 * Clear all cache entries (admin operation)
 */
export async function clearAllCache(): Promise<number> {
  const container = getCacheContainer();

  try {
    const { resources } = await container.items.query<PermissionCacheDocument>({
      query: 'SELECT c.id, c.userId FROM c',
    }).fetchAll();

    let deleted = 0;
    for (const entry of resources) {
      try {
        await container.item(entry.id, entry.userId).delete();
        deleted++;
      } catch {
        // Ignore deletion errors
      }
    }

    return deleted;
  } catch (error) {
    console.error('Cache clear error:', error);
    return 0;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  uniqueUsers: number;
}> {
  const container = getCacheContainer();

  try {
    const { resources: countResult } = await container.items.query({
      query: 'SELECT VALUE COUNT(1) FROM c',
    }).fetchAll();

    const { resources: userResult } = await container.items.query({
      query: 'SELECT DISTINCT c.userId FROM c',
    }).fetchAll();

    return {
      totalEntries: countResult[0] || 0,
      uniqueUsers: userResult.length,
    };
  } catch (error) {
    console.error('Cache stats error:', error);
    return { totalEntries: 0, uniqueUsers: 0 };
  }
}

