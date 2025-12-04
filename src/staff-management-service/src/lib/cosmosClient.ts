/**
 * Cosmos DB Client for Staff Management Service
 */

import { CosmosClient, Container, Database } from '@azure/cosmos';
import { getConfig } from './config';

let cosmosClient: CosmosClient | null = null;
let database: Database | null = null;
let staffContainer: Container | null = null;
let teamsContainer: Container | null = null;
let territoriesContainer: Container | null = null;

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
 * Get the staff-members container
 */
export function getStaffContainer(): Container {
  if (staffContainer) {
    return staffContainer;
  }

  const db = getDatabase();
  const config = getConfig();
  staffContainer = db.container(config.cosmos.containers.staff);
  return staffContainer;
}

/**
 * Get the teams container
 */
export function getTeamsContainer(): Container {
  if (teamsContainer) {
    return teamsContainer;
  }

  const db = getDatabase();
  const config = getConfig();
  teamsContainer = db.container(config.cosmos.containers.teams);
  return teamsContainer;
}

/**
 * Get the territories container
 */
export function getTerritoriesContainer(): Container {
  if (territoriesContainer) {
    return territoriesContainer;
  }

  const db = getDatabase();
  const config = getConfig();
  territoriesContainer = db.container(config.cosmos.containers.territories);
  return territoriesContainer;
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
      config.cosmos.containers.staff,
      config.cosmos.containers.teams,
      config.cosmos.containers.territories,
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
  staffContainer = null;
  teamsContainer = null;
  territoriesContainer = null;
}

