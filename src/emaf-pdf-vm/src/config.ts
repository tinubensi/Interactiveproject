/**
 * Configuration for EMAF PDF VM Service
 */

export interface EmafServiceConfig {
  cosmos: {
    connectionString: string;
    databaseName: string;
    templatesContainer: string;
    submissionsContainer: string;
  };
  blobStorage: {
    connectionString: string;
    containerName: string;
  };
}

export function getConfig(): EmafServiceConfig {
  return {
    cosmos: {
      connectionString: process.env.COSMOS_CONNECTION_STRING || '',
      databaseName: process.env.COSMOS_DATABASE_NAME || 'emaf-service-db',
      templatesContainer: process.env.COSMOS_TEMPLATES_CONTAINER || 'emaf-templates',
      submissionsContainer: process.env.COSMOS_SUBMISSIONS_CONTAINER || 'emaf-submissions',
    },
    blobStorage: {
      connectionString: process.env.BLOB_STORAGE_CONNECTION_STRING || '',
      containerName: process.env.BLOB_CONTAINER_NAME || 'emaf-documents',
    },
  };
}
