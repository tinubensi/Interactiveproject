/**
 * SendBatchNotification Handler
 * POST /api/notifications/send/batch
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { sendBatchNotifications } from '../../lib/notificationService';
import { SendNotificationRequest } from '../../models/Notification';
import { validateServiceKey } from '../../lib/config';

interface BatchNotificationItem {
  templateId: string;
  recipients: string[];
  variables: Record<string, unknown>;
  channels?: ('inApp' | 'email' | 'sms' | 'push')[];
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  source: {
    service: string;
    entityType?: string;
    entityId?: string;
  };
  groupId?: string;
  threadId?: string;
  metadata?: Record<string, unknown>;
}

interface BatchNotificationBody {
  notifications: BatchNotificationItem[];
}

export async function SendBatchNotificationHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('SendBatchNotification function processing request');

  try {
    // Validate service key for internal calls
    const serviceKey = request.headers.get('x-service-key');
    if (!validateServiceKey(serviceKey || undefined)) {
      return {
        status: 401,
        jsonBody: { error: 'Invalid or missing service key' },
      };
    }

    // Parse body
    const body = (await request.json()) as BatchNotificationBody;

    // Validate
    if (!body.notifications || !Array.isArray(body.notifications) || body.notifications.length === 0) {
      return {
        status: 400,
        jsonBody: { error: 'notifications array is required and must not be empty' },
      };
    }

    // Validate each notification
    for (let i = 0; i < body.notifications.length; i++) {
      const item = body.notifications[i];
      if (!item.templateId) {
        return {
          status: 400,
          jsonBody: { error: `notifications[${i}].templateId is required` },
        };
      }
      if (!item.recipients || item.recipients.length === 0) {
        return {
          status: 400,
          jsonBody: { error: `notifications[${i}].recipients is required` },
        };
      }
      if (!item.source || !item.source.service) {
        return {
          status: 400,
          jsonBody: { error: `notifications[${i}].source.service is required` },
        };
      }
    }

    // Build requests
    const requests: SendNotificationRequest[] = body.notifications.map((item) => ({
      templateId: item.templateId,
      recipients: item.recipients,
      variables: item.variables || {},
      channels: item.channels,
      priority: item.priority,
      source: item.source,
      groupId: item.groupId,
      threadId: item.threadId,
      metadata: item.metadata,
    }));

    // Send batch
    const result = await sendBatchNotifications(requests);

    context.log(`Batch notification: ${result.summary.sent}/${result.summary.total} succeeded`);

    return {
      status: 200,
      jsonBody: result,
    };
  } catch (error) {
    context.error('SendBatchNotification error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('SendBatchNotification', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'notifications/send/batch',
  handler: SendBatchNotificationHandler,
});

