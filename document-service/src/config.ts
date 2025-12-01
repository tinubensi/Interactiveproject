/**
 * Configuration module - loads environment variables
 */
export const config = {
  cosmosDb: {
    connectionString: process.env.COSMOS_DB_CONNECTION_STRING || '',
    databaseName: process.env.COSMOS_DB_DATABASE_NAME || 'DocumentDB',
    containerName: process.env.COSMOS_DB_CONTAINER_NAME || 'documents',
  },
  blobStorage: {
    connectionString: process.env.BLOB_STORAGE_CONNECTION_STRING || '',
    containerName: process.env.BLOB_STORAGE_CONTAINER_NAME || 'customerdocuments',
  },
  eventGrid: {
    topicEndpoint: process.env.EVENT_GRID_TOPIC_ENDPOINT || '',
    topicKey: process.env.EVENT_GRID_TOPIC_KEY || '',
  },
};

