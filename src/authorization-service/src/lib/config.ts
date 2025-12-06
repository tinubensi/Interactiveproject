/**
 * Authorization Service Configuration
 */

export interface AuthorizationConfig {
  cosmos: {
    endpoint: string;
    key: string;
    databaseId: string;
    containers: {
      roles: string;
      userRoles: string;
      cache: string;
    };
  };
  cache: {
    ttlSeconds: number;
    enabled: boolean;
  };
  eventGrid: {
    topicEndpoint: string;
    topicKey: string;
  };
  internalServiceKey: string;
}

/**
 * Get configuration from environment variables
 */
export function getConfig(): AuthorizationConfig {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  const databaseId = process.env.COSMOS_DATABASE_ID || 'authz-db';
  const eventGridEndpoint = process.env.EVENT_GRID_TOPIC_ENDPOINT;
  const eventGridKey = process.env.EVENT_GRID_TOPIC_KEY;
  const internalServiceKey = process.env.INTERNAL_SERVICE_KEY;
  const cacheTtl = parseInt(process.env.PERMISSION_CACHE_TTL_SECONDS || '300', 10);

  if (!endpoint) {
    throw new Error('COSMOS_ENDPOINT environment variable is required');
  }
  if (!key) {
    throw new Error('COSMOS_KEY environment variable is required');
  }
  if (!internalServiceKey) {
    throw new Error('INTERNAL_SERVICE_KEY environment variable is required');
  }

  return {
    cosmos: {
      endpoint,
      key,
      databaseId,
      containers: {
        roles: 'role-definitions',
        userRoles: 'user-roles',
        cache: 'permission-cache',
      },
    },
    cache: {
      ttlSeconds: cacheTtl,
      enabled: process.env.PERMISSION_CACHE_ENABLED !== 'false',
    },
    eventGrid: {
      topicEndpoint: eventGridEndpoint || '',
      topicKey: eventGridKey || '',
    },
    internalServiceKey,
  };
}

/**
 * Validate service key header
 */
export function validateServiceKey(headerValue: string | undefined): boolean {
  const config = getConfig();
  return headerValue === config.internalServiceKey;
}

