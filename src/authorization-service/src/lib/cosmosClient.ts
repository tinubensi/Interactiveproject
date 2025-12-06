/**
 * Cosmos DB Client for Authorization Service
 */

import { CosmosClient, Container, Database } from '@azure/cosmos';
import { getConfig } from './config';

let cosmosClient: CosmosClient | null = null;
let database: Database | null = null;
let rolesContainer: Container | null = null;
let userRolesContainer: Container | null = null;
let cacheContainer: Container | null = null;

/**
 * Initialize the Cosmos DB client
 */
export function initializeCosmosClient(): CosmosClient {
  if (cosmosClient) {
    return cosmosClient;
  }

  const config = getConfig();
  cosmosClient = new CosmosClient({
    endpoint: config.cosmos.endpoint,
    key: config.cosmos.key,
  });

  return cosmosClient;
}

/**
 * Get the database instance
 */
export function getDatabase(): Database {
  if (database) {
    return database;
  }

  const client = initializeCosmosClient();
  const config = getConfig();
  database = client.database(config.cosmos.databaseId);
  return database;
}

/**
 * Get the role definitions container
 */
export function getRolesContainer(): Container {
  if (rolesContainer) {
    return rolesContainer;
  }

  const db = getDatabase();
  const config = getConfig();
  rolesContainer = db.container(config.cosmos.containers.roles);
  return rolesContainer;
}

/**
 * Get the user roles container
 */
export function getUserRolesContainer(): Container {
  if (userRolesContainer) {
    return userRolesContainer;
  }

  const db = getDatabase();
  const config = getConfig();
  userRolesContainer = db.container(config.cosmos.containers.userRoles);
  return userRolesContainer;
}

/**
 * Get the permission cache container
 */
export function getCacheContainer(): Container {
  if (cacheContainer) {
    return cacheContainer;
  }

  const db = getDatabase();
  const config = getConfig();
  cacheContainer = db.container(config.cosmos.containers.cache);
  return cacheContainer;
}

/**
 * Check Cosmos DB health
 */
export async function checkCosmosHealth(): Promise<{
  healthy: boolean;
  database?: string;
  containers?: string[];
  error?: string;
}> {
  try {
    const db = getDatabase();
    const config = getConfig();

    // Check database exists
    const { resource: dbInfo } = await db.read();

    // Check containers exist
    const containers = [
      config.cosmos.containers.roles,
      config.cosmos.containers.userRoles,
      config.cosmos.containers.cache,
    ];

    const containerChecks = await Promise.all(
      containers.map(async (name) => {
        try {
          await db.container(name).read();
          return name;
        } catch {
          return null;
        }
      })
    );

    const existingContainers = containerChecks.filter((c) => c !== null) as string[];

    return {
      healthy: existingContainers.length === containers.length,
      database: dbInfo?.id,
      containers: existingContainers,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Reset client instances (for testing)
 */
export function resetClients(): void {
  cosmosClient = null;
  database = null;
  rolesContainer = null;
  userRolesContainer = null;
  cacheContainer = null;
}

