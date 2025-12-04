/**
 * Cosmos DB Client for Authentication Service
 */

import { CosmosClient, Database, Container } from '@azure/cosmos';
import { getConfig } from './config';

let client: CosmosClient | null = null;
let database: Database | null = null;
let sessionsContainer: Container | null = null;
let loginAttemptsContainer: Container | null = null;

/**
 * Initialize Cosmos DB client
 */
export function initializeCosmosClient(): CosmosClient {
  if (client) return client;

  const config = getConfig();

  if (!config.cosmos.endpoint || !config.cosmos.key) {
    throw new Error('Cosmos DB configuration missing. Set COSMOS_ENDPOINT and COSMOS_KEY environment variables.');
  }

  client = new CosmosClient({
    endpoint: config.cosmos.endpoint,
    key: config.cosmos.key,
  });

  return client;
}

/**
 * Get Cosmos DB client (alias for initializeCosmosClient)
 */
export function getCosmosClient(): CosmosClient {
  return initializeCosmosClient();
}

/**
 * Get database instance
 */
export function getDatabase(): Database {
  if (database) return database;

  const config = getConfig();
  const cosmosClient = initializeCosmosClient();
  database = cosmosClient.database(config.cosmos.databaseId);

  return database;
}

/**
 * Get sessions container
 */
export function getSessionsContainer(): Container {
  if (sessionsContainer) return sessionsContainer;

  const config = getConfig();
  const db = getDatabase();
  sessionsContainer = db.container(config.cosmos.containers.sessions);

  return sessionsContainer;
}

/**
 * Get login attempts container
 */
export function getLoginAttemptsContainer(): Container {
  if (loginAttemptsContainer) return loginAttemptsContainer;

  const config = getConfig();
  const db = getDatabase();
  loginAttemptsContainer = db.container(config.cosmos.containers.loginAttempts);

  return loginAttemptsContainer;
}

/**
 * Health check for Cosmos DB
 */
export async function checkCosmosHealth(): Promise<{ status: 'ok' | 'error'; message?: string }> {
  try {
    const db = getDatabase();
    await db.read();
    return { status: 'ok' };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

