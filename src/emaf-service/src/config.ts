/**
 * Configuration for EMAF Service
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
  eventGrid: {
    topicEndpoint: string;
    topicKey: string;
  };
  services: {
    formServiceUrl: string;
    quotationServiceUrl: string;
    leadServiceUrl: string;
    customerServiceUrl?: string;
  };
  queue: {
    pdfGenerationQueueName: string;
  };
  auth: {
    jwtSecret: string;
    serviceKey: string;
  };
  vmPdfServiceUrl: string;
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
      connectionString: process.env.BLOB_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage || '',
      containerName: process.env.BLOB_CONTAINER_NAME || 'emaf-documents',
    },
    eventGrid: {
      topicEndpoint: process.env.EVENT_GRID_TOPIC_ENDPOINT || '',
      topicKey: process.env.EVENT_GRID_TOPIC_KEY || '',
    },
    services: {
      formServiceUrl: process.env.FORM_SERVICE_URL || 'http://localhost:7073',
      quotationServiceUrl: process.env.QUOTATION_SERVICE_URL || 'http://localhost:7075',
      leadServiceUrl: process.env.LEAD_SERVICE_URL || 'http://localhost:7071',
      customerServiceUrl: process.env.CUSTOMER_SERVICE_URL || 'http://localhost:7072',
    },
    queue: {
      pdfGenerationQueueName: process.env.PDF_GENERATION_QUEUE_NAME || 'pdf-generation-queue',
    },
    auth: {
      jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
      serviceKey: process.env.SERVICE_KEY || 'nectaria-internal-2026',
    },
    vmPdfServiceUrl: process.env.VM_PDF_SERVICE_URL || 'http://20.203.51.248/api/pdf',
  };
}
