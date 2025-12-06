/**
 * Audit Service Configuration
 */

export interface AuditConfig {
  cosmos: {
    endpoint: string;
    key: string;
    databaseId: string;
    containers: {
      logs: string;
      summaries: string;
      exports: string;
    };
  };
  eventGrid: {
    topicEndpoint: string;
    topicKey: string;
  };
  storage: {
    connectionString: string;
    containerName: string;
    urlExpiryHours: number;
  };
  query: {
    defaultLimit: number;
    maxLimit: number;
    maxDateRangeDays: number;
  };
  export: {
    maxRecords: number;
    formats: string[];
  };
  pii: {
    fieldsToMask: string[];
    fieldsToPartialMask: string[];
    fieldsToHash: string[];
    maskPattern: string;
  };
  internalServiceKey: string;
}

/**
 * Get configuration from environment variables
 */
export function getConfig(): AuditConfig {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  const databaseId = process.env.COSMOS_DATABASE_ID || 'audit-db';
  const eventGridEndpoint = process.env.EVENT_GRID_TOPIC_ENDPOINT;
  const eventGridKey = process.env.EVENT_GRID_TOPIC_KEY;
  const storageConnectionString = process.env.BLOB_STORAGE_CONNECTION_STRING;
  const blobContainerName = process.env.BLOB_CONTAINER_NAME || 'audit-exports';
  const internalServiceKey = process.env.INTERNAL_SERVICE_KEY;

  if (!endpoint) {
    throw new Error('COSMOS_ENDPOINT environment variable is required');
  }
  if (!key) {
    throw new Error('COSMOS_KEY environment variable is required');
  }
  if (!internalServiceKey) {
    throw new Error('INTERNAL_SERVICE_KEY environment variable is required');
  }

  return {
    cosmos: {
      endpoint,
      key,
      databaseId,
      containers: {
        logs: 'audit-logs',
        summaries: 'audit-summaries',
        exports: 'exports',
      },
    },
    eventGrid: {
      topicEndpoint: eventGridEndpoint || '',
      topicKey: eventGridKey || '',
    },
    storage: {
      connectionString: storageConnectionString || '',
      containerName: blobContainerName,
      urlExpiryHours: parseInt(process.env.EXPORT_URL_EXPIRY_HOURS || '1', 10),
    },
    query: {
      defaultLimit: parseInt(process.env.QUERY_DEFAULT_LIMIT || '50', 10),
      maxLimit: parseInt(process.env.QUERY_MAX_LIMIT || '100', 10),
      maxDateRangeDays: parseInt(process.env.QUERY_MAX_DATE_RANGE_DAYS || '90', 10),
    },
    export: {
      maxRecords: parseInt(process.env.EXPORT_MAX_RECORDS || '100000', 10),
      formats: ['pdf', 'csv'],
    },
    pii: {
      fieldsToMask: [
        'ssn', 'socialSecurityNumber',
        'passport', 'passportNumber',
        'creditCard', 'cardNumber',
        'bankAccount', 'accountNumber',
        'password', 'secret', 'token',
        'otp', 'pin', 'cvv',
      ],
      fieldsToPartialMask: [
        'phone', 'phoneNumber', 'mobile',
        'emiratesId',
      ],
      fieldsToHash: [
        'email',
      ],
      maskPattern: '***MASKED***',
    },
    internalServiceKey,
  };
}

/**
 * Validate service key header
 */
export function validateServiceKey(headerValue: string | undefined): boolean {
  const config = getConfig();
  return headerValue === config.internalServiceKey;
}

/**
 * TTL values in seconds
 */
export const TTL = {
  LOGS: null,  // No TTL - permanent
  SUMMARIES: 365 * 24 * 60 * 60,  // 365 days
  EXPORTS: 24 * 60 * 60,  // 24 hours
} as const;

