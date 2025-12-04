/**
 * Staff Management Service Configuration
 */

export interface StaffConfig {
  cosmos: {
    endpoint: string;
    key: string;
    databaseId: string;
    containers: {
      staff: string;
      teams: string;
      territories: string;
    };
  };
  eventGrid: {
    topicEndpoint: string;
    topicKey: string;
  };
  workload: {
    defaultMaxLeads: number;
    defaultMaxCustomers: number;
    warningThreshold: number;
    blockThreshold: number;
  };
  license: {
    alertDays: number[];
    restrictOnExpiry: boolean;
  };
  internalServiceKey: string;
}

/**
 * Get configuration from environment variables
 */
export function getConfig(): StaffConfig {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  const databaseId = process.env.COSMOS_DATABASE_ID || 'staff-db';
  const eventGridEndpoint = process.env.EVENT_GRID_TOPIC_ENDPOINT;
  const eventGridKey = process.env.EVENT_GRID_TOPIC_KEY;
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

  // Parse license alert days
  const alertDaysStr = process.env.LICENSE_ALERT_DAYS || '30,14,7,3,1';
  const alertDays = alertDaysStr.split(',').map((d) => parseInt(d.trim(), 10));

  return {
    cosmos: {
      endpoint,
      key,
      databaseId,
      containers: {
        staff: 'staff-members',
        teams: 'teams',
        territories: 'territories',
      },
    },
    eventGrid: {
      topicEndpoint: eventGridEndpoint || '',
      topicKey: eventGridKey || '',
    },
    workload: {
      defaultMaxLeads: parseInt(process.env.WORKLOAD_DEFAULT_MAX_LEADS || '20', 10),
      defaultMaxCustomers: parseInt(process.env.WORKLOAD_DEFAULT_MAX_CUSTOMERS || '60', 10),
      warningThreshold: parseFloat(process.env.WORKLOAD_WARNING_THRESHOLD || '0.8'),
      blockThreshold: parseFloat(process.env.WORKLOAD_BLOCK_THRESHOLD || '1.0'),
    },
    license: {
      alertDays,
      restrictOnExpiry: process.env.LICENSE_RESTRICT_ON_EXPIRY === 'true',
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

