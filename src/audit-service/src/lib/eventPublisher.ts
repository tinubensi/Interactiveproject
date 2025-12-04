/**
 * Event Grid Publisher for Audit Service
 */

import { EventGridPublisherClient, AzureKeyCredential } from '@azure/eventgrid';
import { getConfig } from './config';
import { SecurityAlert } from './securityAlerter';

let publisherClient: EventGridPublisherClient<'EventGrid'> | null = null;

/**
 * Event types published by the Audit Service
 */
export const AUDIT_EVENTS = {
  SECURITY_ALERT_TRIGGERED: 'security.alert.triggered',
  EXPORT_COMPLETED: 'audit.export.completed',
  EXPORT_FAILED: 'audit.export.failed',
} as const;

export type AuditEventType = typeof AUDIT_EVENTS[keyof typeof AUDIT_EVENTS];

/**
 * Initialize the Event Grid publisher client
 */
export function getPublisherClient(): EventGridPublisherClient<'EventGrid'> | null {
  const config = getConfig();
  
  if (!config.eventGrid.topicEndpoint || !config.eventGrid.topicKey) {
    console.warn('Event Grid not configured - events will not be published');
    return null;
  }

  if (publisherClient) {
    return publisherClient;
  }

  publisherClient = new EventGridPublisherClient<'EventGrid'>(
    config.eventGrid.topicEndpoint,
    'EventGrid',
    new AzureKeyCredential(config.eventGrid.topicKey)
  );

  return publisherClient;
}

/**
 * Publish a security alert event
 */
export async function publishSecurityAlert(alert: SecurityAlert): Promise<void> {
  const client = getPublisherClient();
  
  if (!client) {
    console.log(`[Security Alert] ${alert.alertType}:`, alert.title);
    return;
  }

  try {
    await client.send([
      {
        eventType: AUDIT_EVENTS.SECURITY_ALERT_TRIGGERED,
        subject: '/security/alerts',
        dataVersion: '1.0',
        data: alert,
      },
    ]);
    console.log(`[Security Alert Published] ${alert.alertType}`);
  } catch (error) {
    console.error('[Security Alert Error] Failed to publish alert:', error);
  }
}

/**
 * Publish export completed event
 */
export async function publishExportCompleted(
  exportId: string,
  requestedBy: string,
  recordCount: number,
  format: string
): Promise<void> {
  const client = getPublisherClient();
  
  if (!client) {
    console.log(`[Export Completed] ${exportId}: ${recordCount} records`);
    return;
  }

  try {
    await client.send([
      {
        eventType: AUDIT_EVENTS.EXPORT_COMPLETED,
        subject: `/audit/exports/${exportId}`,
        dataVersion: '1.0',
        data: {
          exportId,
          requestedBy,
          recordCount,
          format,
          timestamp: new Date().toISOString(),
        },
      },
    ]);
    console.log(`[Export Completed Published] ${exportId}`);
  } catch (error) {
    console.error('[Export Event Error] Failed to publish:', error);
  }
}

/**
 * Publish export failed event
 */
export async function publishExportFailed(
  exportId: string,
  requestedBy: string,
  errorCode: string,
  errorMessage: string
): Promise<void> {
  const client = getPublisherClient();
  
  if (!client) {
    console.log(`[Export Failed] ${exportId}: ${errorMessage}`);
    return;
  }

  try {
    await client.send([
      {
        eventType: AUDIT_EVENTS.EXPORT_FAILED,
        subject: `/audit/exports/${exportId}`,
        dataVersion: '1.0',
        data: {
          exportId,
          requestedBy,
          errorCode,
          errorMessage,
          timestamp: new Date().toISOString(),
        },
      },
    ]);
    console.log(`[Export Failed Published] ${exportId}`);
  } catch (error) {
    console.error('[Export Event Error] Failed to publish:', error);
  }
}

/**
 * Reset publisher client (for testing)
 */
export function resetPublisherClient(): void {
  publisherClient = null;
}

