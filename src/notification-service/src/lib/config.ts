/**
 * Notification Service Configuration
 */

export interface NotificationConfig {
  cosmos: {
    endpoint: string;
    key: string;
    databaseId: string;
    containers: {
      notifications: string;
      templates: string;
      preferences: string;
    };
  };
  acs: {
    connectionString: string;
    senderEmail: string;
    senderPhone: string;
  };
  signalR: {
    connectionString: string;
    hubName: string;
  };
  eventGrid: {
    topicEndpoint: string;
    topicKey: string;
  };
  rateLimits: {
    emailPerUser: number;
    smsPerUser: number;
    pushPerUser: number;
  };
  notificationTtlDays: number;
  internalServiceKey: string;
  staffServiceUrl: string;
}

/**
 * Get configuration from environment variables
 */
export function getConfig(): NotificationConfig {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  const databaseId = process.env.COSMOS_DATABASE_ID || 'notification-db';
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
        notifications: 'notifications',
        templates: 'templates',
        preferences: 'preferences',
      },
    },
    acs: {
      connectionString: process.env.ACS_CONNECTION_STRING || '',
      senderEmail: process.env.ACS_SENDER_EMAIL || 'noreply@nectaria.com',
      senderPhone: process.env.ACS_SENDER_PHONE || '',
    },
    signalR: {
      connectionString: process.env.SIGNALR_CONNECTION_STRING || '',
      hubName: process.env.SIGNALR_HUB_NAME || 'notifications',
    },
    eventGrid: {
      topicEndpoint: process.env.EVENT_GRID_TOPIC_ENDPOINT || '',
      topicKey: process.env.EVENT_GRID_TOPIC_KEY || '',
    },
    rateLimits: {
      emailPerUser: parseInt(process.env.RATE_LIMIT_EMAIL_PER_USER || '50', 10),
      smsPerUser: parseInt(process.env.RATE_LIMIT_SMS_PER_USER || '10', 10),
      pushPerUser: parseInt(process.env.RATE_LIMIT_PUSH_PER_USER || '100', 10),
    },
    notificationTtlDays: parseInt(process.env.NOTIFICATION_TTL_DAYS || '90', 10),
    internalServiceKey,
    staffServiceUrl: process.env.STAFF_SERVICE_URL || 'http://localhost:7074',
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
 * Get TTL in seconds
 */
export function getTtlSeconds(): number {
  try {
    const config = getConfig();
    return config.notificationTtlDays * 24 * 60 * 60;
  } catch {
    return 90 * 24 * 60 * 60; // 90 days default
  }
}

