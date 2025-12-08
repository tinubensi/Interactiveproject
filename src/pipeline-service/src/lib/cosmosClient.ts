/**
 * Cosmos DB Client for Pipeline Service
 */

import { CosmosClient, Container, Database } from '@azure/cosmos';
import { getConfig } from './config';

let client: CosmosClient | null = null;
let database: Database | null = null;

// Containers
let pipelinesContainer: Container | null = null;
let instancesContainer: Container | null = null;
let approvalsContainer: Container | null = null;

/**
 * Get or create the Cosmos DB client
 */
export function getCosmosClient(): CosmosClient {
  if (client) {
    return client;
  }

  const config = getConfig();
  const { endpoint, key } = config.cosmos;

  // Handle local emulator
  if (endpoint.includes('localhost') || endpoint.includes('127.0.0.1')) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  client = new CosmosClient({ endpoint, key });
  return client;
}

/**
 * Get the database instance
 */
export function getDatabase(): Database {
  if (database) {
    return database;
  }

  const config = getConfig();
  const cosmosClient = getCosmosClient();
  database = cosmosClient.database(config.cosmos.databaseId);
  return database;
}

/**
 * Get the pipelines container
 */
export function getPipelinesContainer(): Container {
  if (pipelinesContainer) {
    return pipelinesContainer;
  }
  pipelinesContainer = getDatabase().container('pipelines');
  return pipelinesContainer;
}

/**
 * Get the instances container
 */
export function getInstancesContainer(): Container {
  if (instancesContainer) {
    return instancesContainer;
  }
  instancesContainer = getDatabase().container('instances');
  return instancesContainer;
}

/**
 * Get the approvals container
 */
export function getApprovalsContainer(): Container {
  if (approvalsContainer) {
    return approvalsContainer;
  }
  approvalsContainer = getDatabase().container('approvals');
  return approvalsContainer;
}

/**
 * Initialize database and containers
 */
export async function initializeDatabase(): Promise<void> {
  const config = getConfig();
  const cosmosClient = getCosmosClient();

  // Create database if not exists
  await cosmosClient.databases.createIfNotExists({
    id: config.cosmos.databaseId,
  });

  const db = getDatabase();

  // Create containers if not exist
  await db.containers.createIfNotExists({
    id: 'pipelines',
    partitionKey: { paths: ['/lineOfBusiness'] },
    indexingPolicy: {
      indexingMode: 'consistent',
      automatic: true,
      includedPaths: [{ path: '/*' }],
      excludedPaths: [{ path: '/_etag/?' }],
    },
  });

  await db.containers.createIfNotExists({
    id: 'instances',
    partitionKey: { paths: ['/leadId'] },
    indexingPolicy: {
      indexingMode: 'consistent',
      automatic: true,
      includedPaths: [{ path: '/*' }],
      excludedPaths: [{ path: '/_etag/?' }],
    },
  });

  await db.containers.createIfNotExists({
    id: 'approvals',
    partitionKey: { paths: ['/instanceId'] },
    indexingPolicy: {
      indexingMode: 'consistent',
      automatic: true,
      includedPaths: [{ path: '/*' }],
      excludedPaths: [{ path: '/_etag/?' }],
    },
  });

  // Update container references
  pipelinesContainer = db.container('pipelines');
  instancesContainer = db.container('instances');
  approvalsContainer = db.container('approvals');

  console.log('Pipeline Service database initialized');
}

