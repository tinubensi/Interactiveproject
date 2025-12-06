/**
 * Cosmos DB Client for Notification Service
 */

import { CosmosClient, Container, Database } from '@azure/cosmos';
import { getConfig } from './config';

let cosmosClient: CosmosClient | null = null;
let database: Database | null = null;
let notificationsContainer: Container | null = null;
let templatesContainer: Container | null = null;
let preferencesContainer: Container | null = null;

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
 * Get the notifications container
 */
export function getNotificationsContainer(): Container {
  if (notificationsContainer) {
    return notificationsContainer;
  }

  const db = getDatabase();
  const config = getConfig();
  notificationsContainer = db.container(config.cosmos.containers.notifications);
  return notificationsContainer;
}

/**
 * Get the templates container
 */
export function getTemplatesContainer(): Container {
  if (templatesContainer) {
    return templatesContainer;
  }

  const db = getDatabase();
  const config = getConfig();
  templatesContainer = db.container(config.cosmos.containers.templates);
  return templatesContainer;
}

/**
 * Get the preferences container
 */
export function getPreferencesContainer(): Container {
  if (preferencesContainer) {
    return preferencesContainer;
  }

  const db = getDatabase();
  const config = getConfig();
  preferencesContainer = db.container(config.cosmos.containers.preferences);
  return preferencesContainer;
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
      config.cosmos.containers.notifications,
      config.cosmos.containers.templates,
      config.cosmos.containers.preferences,
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
  notificationsContainer = null;
  templatesContainer = null;
  preferencesContainer = null;
}

