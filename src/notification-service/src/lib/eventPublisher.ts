/**
 * Event Grid Publisher for Notification Service
 */

import { EventGridPublisherClient, AzureKeyCredential } from '@azure/eventgrid';
import { getConfig } from './config';

let publisherClient: EventGridPublisherClient<'EventGrid'> | null = null;

/**
 * Event types published by the Notification Service
 */
export const NOTIFICATION_EVENTS = {
  NOTIFICATION_SENT: 'notification.sent',
  NOTIFICATION_DELIVERED: 'notification.delivered',
  NOTIFICATION_FAILED: 'notification.failed',
  NOTIFICATION_READ: 'notification.read',
} as const;

export type NotificationEventType = typeof NOTIFICATION_EVENTS[keyof typeof NOTIFICATION_EVENTS];

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
 * Publish a notification event
 */
export async function publishNotificationEvent(
  eventType: NotificationEventType,
  notificationId: string,
  userId: string,
  data: Record<string, unknown>
): Promise<void> {
  const client = getPublisherClient();

  if (!client) {
    console.log(`[Notification Event] ${eventType}:`, { notificationId, userId, ...data });
    return;
  }

  try {
    await client.send([
      {
        eventType,
        subject: `/notifications/${notificationId}`,
        dataVersion: '1.0',
        data: {
          notificationId,
          userId,
          ...data,
          timestamp: new Date().toISOString(),
        },
      },
    ]);
    console.log(`[Notification Event Published] ${eventType} for ${notificationId}`);
  } catch (error) {
    console.error(`[Notification Event Error] Failed to publish ${eventType}:`, error);
  }
}

/**
 * Reset publisher client (for testing)
 */
export function resetPublisherClient(): void {
  publisherClient = null;
}

