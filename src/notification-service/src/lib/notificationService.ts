/**
 * Notification Service - Main orchestration layer
 */

import {
  SendNotificationRequest,
  SendNotificationResponse,
  RecipientSendResult,
  NotificationCategory,
  NotificationPriority,
  NotificationType,
  NotificationSource,
  ChannelDeliveryStatus,
  DeliveryStatus,
} from '../models/Notification';
import { NotificationChannel, NotificationTemplateDocument, RenderedContent } from '../models/NotificationTemplate';
import { NotificationPreferencesDocument } from '../models/NotificationPreferences';
import { findTemplateById } from './templateRepository';
import { getOrCreatePreferences, filterChannelsByPreferences } from './preferencesRepository';
import { createNotification } from './notificationRepository';
import { renderAllChannels, validateVariables } from './templateRenderer';
import { sendEmail } from './channels/emailChannel';
import { sendSms } from './channels/smsChannel';
import { sendPush } from './channels/pushChannel';
import { publishNotificationEvent, NOTIFICATION_EVENTS } from './eventPublisher';

/**
 * Send notification to recipients
 */
export async function sendNotification(
  request: SendNotificationRequest
): Promise<SendNotificationResponse> {
  // Load template
  const template = await findTemplateById(request.templateId);
  if (!template) {
    throw new Error(`Template "${request.templateId}" not found`);
  }

  if (!template.isActive) {
    throw new Error(`Template "${request.templateId}" is not active`);
  }

  // Validate variables
  const validation = validateVariables(template, request.variables);
  if (!validation.valid) {
    throw new Error(`Invalid variables: ${validation.errors.join(', ')}`);
  }

  // Render template
  const rendered = renderAllChannels(template, request.variables);

  // Determine channels to use
  const requestedChannels = request.channels || template.defaultChannels;

  // Process each recipient
  const results: RecipientSendResult[] = [];
  let sent = 0;
  let failed = 0;

  for (const userId of request.recipients) {
    try {
      const result = await sendToRecipient(
        userId,
        template,
        rendered,
        requestedChannels,
        request.priority || template.priority,
        request.source,
        request.groupId,
        request.threadId,
        request.metadata
      );
      results.push(result);

      // Check if at least one channel succeeded
      const anySuccess = Object.values(result.channels).some((ch) => ch?.sent);
      if (anySuccess) {
        sent++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`Failed to send notification to ${userId}:`, error);
      failed++;
      results.push({
        notificationId: '',
        userId,
        channels: {
          inApp: { sent: false, failed: true, failureReason: 'processing_error' },
        },
      });
    }
  }

  return {
    notifications: results,
    summary: {
      total: request.recipients.length,
      sent,
      failed,
    },
  };
}

/**
 * Send notification to a single recipient
 */
async function sendToRecipient(
  userId: string,
  template: NotificationTemplateDocument,
  rendered: RenderedContent,
  requestedChannels: NotificationChannel[],
  priority: NotificationPriority,
  source: NotificationSource,
  groupId?: string,
  threadId?: string,
  metadata?: Record<string, unknown>
): Promise<RecipientSendResult> {
  // Get or create user preferences
  // Note: In production, we'd look up user's email from a user service
  const userEmail = metadata?.userEmail as string || `${userId}@nectaria.com`;
  const preferences = await getOrCreatePreferences(userId, userEmail);

  // Filter channels based on preferences
  const enabledChannels = filterChannelsByPreferences(
    requestedChannels,
    preferences,
    template.category
  );

  // Initialize delivery status
  const channelDelivery: ChannelDeliveryStatus = {
    inApp: { sent: false },
  };

  // Send via each enabled channel
  for (const channel of enabledChannels) {
    const status = await sendViaChannel(channel, rendered, preferences, template.category);
    channelDelivery[channel] = status;
  }

  // Always create in-app notification if inApp channel is enabled
  const shouldCreateInApp = enabledChannels.includes('inApp') || requestedChannels.includes('inApp');

  if (shouldCreateInApp) {
    const notification = await createNotification({
      userId,
      type: template.type,
      title: rendered.inApp.title,
      message: rendered.inApp.message,
      body: rendered.inApp.body,
      category: template.category,
      priority,
      source,
      channels: channelDelivery,
      action: rendered.action
        ? {
            type: rendered.action.type as 'link' | 'button' | 'deeplink',
            label: rendered.action.label,
            url: rendered.action.url,
          }
        : undefined,
      groupId,
      threadId,
      metadata,
    });

    // Update inApp delivery status
    channelDelivery.inApp = {
      sent: true,
      sentAt: new Date().toISOString(),
    };

    // Publish notification sent event
    await publishNotificationEvent(
      NOTIFICATION_EVENTS.NOTIFICATION_SENT,
      notification.id,
      userId,
      {
        templateId: template.templateId,
        category: template.category,
        priority,
        channels: Object.keys(channelDelivery).filter(
          (ch) => channelDelivery[ch as keyof ChannelDeliveryStatus]?.sent
        ),
      }
    );

    return {
      notificationId: notification.id,
      userId,
      channels: channelDelivery,
    };
  }

  return {
    notificationId: '',
    userId,
    channels: channelDelivery,
  };
}

/**
 * Send via a specific channel
 */
async function sendViaChannel(
  channel: NotificationChannel,
  rendered: RenderedContent,
  preferences: NotificationPreferencesDocument,
  category: NotificationCategory
): Promise<DeliveryStatus> {
  const now = new Date().toISOString();

  switch (channel) {
    case 'inApp':
      // In-app is handled by createNotification
      return { sent: true, sentAt: now };

    case 'email':
      if (!rendered.email) {
        return { sent: false, failed: true, failureReason: 'no_email_content' };
      }
      return sendEmail(
        preferences.email,
        rendered.email.subject,
        rendered.email.bodyHtml,
        rendered.email.bodyText
      );

    case 'sms':
      if (!rendered.sms) {
        return { sent: false, failed: true, failureReason: 'no_sms_content' };
      }
      if (!preferences.phone) {
        return { sent: false, failed: true, failureReason: 'no_phone_number' };
      }
      return sendSms(preferences.phone, rendered.sms.message);

    case 'push':
      if (!rendered.push) {
        return { sent: false, failed: true, failureReason: 'no_push_content' };
      }
      if (!preferences.pushTokens?.length) {
        return { sent: false, failed: true, failureReason: 'no_push_tokens' };
      }
      return sendPush(preferences.pushTokens, rendered.push.title, rendered.push.body);

    default:
      return { sent: false, failed: true, failureReason: 'unknown_channel' };
  }
}

/**
 * Send batch notifications (multiple templates)
 */
export async function sendBatchNotifications(
  requests: SendNotificationRequest[]
): Promise<{
  results: SendNotificationResponse[];
  summary: { total: number; sent: number; failed: number };
}> {
  const results: SendNotificationResponse[] = [];
  let totalSent = 0;
  let totalFailed = 0;

  for (const request of requests) {
    try {
      const result = await sendNotification(request);
      results.push(result);
      totalSent += result.summary.sent;
      totalFailed += result.summary.failed;
    } catch (error) {
      console.error('Batch notification failed:', error);
      totalFailed += request.recipients.length;
      results.push({
        notifications: request.recipients.map((userId) => ({
          notificationId: '',
          userId,
          channels: {
            inApp: { sent: false, failed: true, failureReason: 'batch_processing_error' },
          },
        })),
        summary: {
          total: request.recipients.length,
          sent: 0,
          failed: request.recipients.length,
        },
      });
    }
  }

  return {
    results,
    summary: {
      total: results.reduce((sum, r) => sum + r.summary.total, 0),
      sent: totalSent,
      failed: totalFailed,
    },
  };
}

/**
 * Resolve recipients from role or user IDs
 * (In production, this would call the authorization service)
 */
export async function resolveRecipients(
  assignedTo: string | string[]
): Promise<string[]> {
  if (Array.isArray(assignedTo)) {
    return assignedTo;
  }

  // If it's a role, resolve to user IDs
  // For MVP, just return as-is (single user)
  // In production: call authorization service to get users with role
  return [assignedTo];
}

