/**
 * Configuration for Pipeline Service
 */

export interface PipelineServiceConfig {
  cosmos: {
    endpoint: string;
    key: string;
    databaseId: string;
  };
  eventGrid: {
    topicEndpoint: string;
    topicKey: string;
  };
  services: {
    authServiceUrl: string;
    authzServiceUrl: string;
    leadServiceUrl: string;
    documentServiceUrl: string;
  };
  internalServiceKey: string;
}

let configInstance: PipelineServiceConfig | null = null;

export function getConfig(): PipelineServiceConfig {
  if (configInstance) {
    return configInstance;
  }

  configInstance = {
    cosmos: {
      endpoint: process.env.COSMOS_ENDPOINT || '',
      key: process.env.COSMOS_KEY || '',
      databaseId: process.env.COSMOS_DATABASE_ID || 'pipeline-db',
    },
    eventGrid: {
      topicEndpoint: process.env.EVENT_GRID_TOPIC_ENDPOINT || '',
      topicKey: process.env.EVENT_GRID_TOPIC_KEY || '',
    },
    services: {
      authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:7071',
      authzServiceUrl: process.env.AUTHZ_SERVICE_URL || 'http://localhost:7072',
      leadServiceUrl: process.env.LEAD_SERVICE_URL || 'http://localhost:7078',
      documentServiceUrl: process.env.DOCUMENT_SERVICE_URL || 'http://localhost:7073',
    },
    internalServiceKey: process.env.INTERNAL_SERVICE_KEY || '',
  };

  return configInstance;
}

/**
 * Validate required configuration
 */
export function validateConfig(): void {
  const config = getConfig();
  
  const required = [
    { key: 'COSMOS_ENDPOINT', value: config.cosmos.endpoint },
    { key: 'COSMOS_KEY', value: config.cosmos.key },
  ];

  const missing = required.filter(({ value }) => !value);
  
  if (missing.length > 0) {
    const keys = missing.map(({ key }) => key).join(', ');
    throw new Error(`Missing required configuration: ${keys}`);
  }
}

