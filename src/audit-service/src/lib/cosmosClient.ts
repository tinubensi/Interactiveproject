/**
 * Cosmos DB Client for Audit Service
 */

import { CosmosClient, Container, Database } from '@azure/cosmos';
import { getConfig } from './config';

let cosmosClient: CosmosClient | null = null;
let database: Database | null = null;
let logsContainer: Container | null = null;
let summariesContainer: Container | null = null;
let exportsContainer: Container | null = null;

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
 * Get the audit logs container
 */
export function getLogsContainer(): Container {
  if (logsContainer) {
    return logsContainer;
  }

  const db = getDatabase();
  const config = getConfig();
  logsContainer = db.container(config.cosmos.containers.logs);
  return logsContainer;
}

/**
 * Get the summaries container
 */
export function getSummariesContainer(): Container {
  if (summariesContainer) {
    return summariesContainer;
  }

  const db = getDatabase();
  const config = getConfig();
  summariesContainer = db.container(config.cosmos.containers.summaries);
  return summariesContainer;
}

/**
 * Get the exports container
 */
export function getExportsContainer(): Container {
  if (exportsContainer) {
    return exportsContainer;
  }

  const db = getDatabase();
  const config = getConfig();
  exportsContainer = db.container(config.cosmos.containers.exports);
  return exportsContainer;
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
      config.cosmos.containers.logs,
      config.cosmos.containers.summaries,
      config.cosmos.containers.exports,
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
  logsContainer = null;
  summariesContainer = null;
  exportsContainer = null;
}

