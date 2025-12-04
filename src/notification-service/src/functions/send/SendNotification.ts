/**
 * SendNotification Handler
 * POST /api/notifications/send
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { sendNotification } from '../../lib/notificationService';
import { SendNotificationRequest } from '../../models/Notification';
import { validateServiceKey } from '../../lib/config';

interface SendNotificationBody {
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
  scheduledFor?: string;
}

export async function SendNotificationHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('SendNotification function processing request');

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
    const body = (await request.json()) as SendNotificationBody;

    // Validate required fields
    if (!body.templateId) {
      return {
        status: 400,
        jsonBody: { error: 'templateId is required' },
      };
    }

    if (!body.recipients || !Array.isArray(body.recipients) || body.recipients.length === 0) {
      return {
        status: 400,
        jsonBody: { error: 'recipients array is required and must not be empty' },
      };
    }

    if (!body.source || !body.source.service) {
      return {
        status: 400,
        jsonBody: { error: 'source.service is required' },
      };
    }

    // TODO: Handle scheduled notifications
    if (body.scheduledFor) {
      context.log('Scheduled notifications not yet implemented');
    }

    // Build request
    const notificationRequest: SendNotificationRequest = {
      templateId: body.templateId,
      recipients: body.recipients,
      variables: body.variables || {},
      channels: body.channels,
      priority: body.priority,
      source: body.source,
      groupId: body.groupId,
      threadId: body.threadId,
      metadata: body.metadata,
    };

    // Send notification
    const result = await sendNotification(notificationRequest);

    context.log(`Notification sent: ${result.summary.sent}/${result.summary.total} succeeded`);

    return {
      status: 200,
      jsonBody: result,
    };
  } catch (error) {
    context.error('SendNotification error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return {
        status: 404,
        jsonBody: { error: error.message },
      };
    }

    if (error instanceof Error && error.message.includes('Invalid variables')) {
      return {
        status: 400,
        jsonBody: { error: error.message },
      };
    }

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('SendNotification', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'notifications/send',
  handler: SendNotificationHandler,
});

