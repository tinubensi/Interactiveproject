/**
 * Notification Repository - CRUD operations for notifications
 */

import { v4 as uuidv4 } from 'uuid';
import { getNotificationsContainer } from './cosmosClient';
import { getTtlSeconds } from './config';
import {
  NotificationDocument,
  NotificationCategory,
  NotificationPriority,
  NotificationType,
  DeliveryStatus,
  ChannelDeliveryStatus,
  NotificationSource,
  NotificationAction,
  UserNotificationsQuery,
  NotificationSummary,
  UnreadCountResponse,
} from '../models/Notification';

/**
 * Create a new notification
 */
export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  body?: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  source: NotificationSource;
  channels: ChannelDeliveryStatus;
  action?: NotificationAction;
  groupId?: string;
  threadId?: string;
  metadata?: Record<string, unknown>;
}): Promise<NotificationDocument> {
  const container = getNotificationsContainer();
  const now = new Date().toISOString();
  const ttl = getTtlSeconds();
  const notificationId = uuidv4();

  // Calculate expiry date
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + ttl);

  const document: NotificationDocument = {
    id: notificationId,
    notificationId,
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    body: params.body,
    category: params.category,
    priority: params.priority,
    source: params.source,
    channels: params.channels,
    action: params.action,
    isRead: false,
    groupId: params.groupId,
    threadId: params.threadId,
    metadata: params.metadata,
    createdAt: now,
    expiresAt: expiresAt.toISOString(),
    ttl,
  };

  const { resource } = await container.items.create(document);

  if (!resource) {
    throw new Error('Failed to create notification');
  }

  return resource;
}

/**
 * Find notification by ID
 */
export async function findNotificationById(
  notificationId: string,
  userId: string
): Promise<NotificationDocument | null> {
  const container = getNotificationsContainer();

  try {
    const { resource } = await container
      .item(notificationId, userId)
      .read<NotificationDocument>();
    return resource || null;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Get notifications for a user
 */
export async function getUserNotifications(
  userId: string,
  query: UserNotificationsQuery
): Promise<{ notifications: NotificationSummary[]; continuationToken?: string }> {
  const container = getNotificationsContainer();
  const limit = query.limit || 50;

  let queryText = 'SELECT * FROM c WHERE c.userId = @userId';
  const parameters: { name: string; value: string | boolean }[] = [
    { name: '@userId', value: userId },
  ];

  // Filter by category
  if (query.category) {
    queryText += ' AND c.category = @category';
    parameters.push({ name: '@category', value: query.category });
  }

  // Filter by read status
  if (query.isRead !== undefined) {
    queryText += ' AND c.isRead = @isRead';
    parameters.push({ name: '@isRead', value: query.isRead });
  }

  queryText += ' ORDER BY c.createdAt DESC';

  const queryOptions: { query: string; parameters: typeof parameters; maxItemCount?: number; continuationToken?: string } = {
    query: queryText,
    parameters,
    maxItemCount: limit,
  };

  if (query.continuationToken) {
    queryOptions.continuationToken = query.continuationToken;
  }

  const iterator = container.items.query<NotificationDocument>(queryOptions);
  const { resources, continuationToken } = await iterator.fetchNext();

  const notifications: NotificationSummary[] = resources.map((n) => ({
    id: n.id,
    type: n.type,
    category: n.category,
    priority: n.priority,
    title: n.title,
    message: n.message,
    isRead: n.isRead,
    createdAt: n.createdAt,
    action: n.action,
    source: n.source,
  }));

  return {
    notifications,
    continuationToken: continuationToken || undefined,
  };
}

/**
 * Get unread count for a user
 */
export async function getUnreadCount(userId: string): Promise<UnreadCountResponse> {
  const container = getNotificationsContainer();

  // Get all unread notifications
  const { resources } = await container.items
    .query<NotificationDocument>({
      query: 'SELECT * FROM c WHERE c.userId = @userId AND c.isRead = false',
      parameters: [{ name: '@userId', value: userId }],
    })
    .fetchAll();

  // Count by category
  const byCategory: Record<NotificationCategory, number> = {
    approval: 0,
    assignment: 0,
    reminder: 0,
    alert: 0,
    update: 0,
    security: 0,
    compliance: 0,
    system: 0,
  };

  // Count by priority
  const byPriority: Record<NotificationPriority, number> = {
    low: 0,
    normal: 0,
    high: 0,
    urgent: 0,
  };

  for (const notification of resources) {
    byCategory[notification.category]++;
    byPriority[notification.priority]++;
  }

  return {
    total: resources.length,
    byCategory,
    byPriority,
  };
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<NotificationDocument | null> {
  const container = getNotificationsContainer();
  const notification = await findNotificationById(notificationId, userId);

  if (!notification) {
    return null;
  }

  if (notification.isRead) {
    return notification; // Already read
  }

  const updated: NotificationDocument = {
    ...notification,
    isRead: true,
    readAt: new Date().toISOString(),
  };

  const { resource } = await container.item(notificationId, userId).replace(updated);
  return (resource as unknown as NotificationDocument) || null;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(userId: string): Promise<number> {
  const container = getNotificationsContainer();

  // Get all unread notifications
  const { resources } = await container.items
    .query<NotificationDocument>({
      query: 'SELECT * FROM c WHERE c.userId = @userId AND c.isRead = false',
      parameters: [{ name: '@userId', value: userId }],
    })
    .fetchAll();

  const now = new Date().toISOString();
  let count = 0;

  // Update each notification
  for (const notification of resources) {
    const updated: NotificationDocument = {
      ...notification,
      isRead: true,
      readAt: now,
    };

    await container.item(notification.id, userId).replace(updated);
    count++;
  }

  return count;
}

/**
 * Delete notification
 */
export async function deleteNotification(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const container = getNotificationsContainer();

  try {
    await container.item(notificationId, userId).delete();
    return true;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Update notification delivery status
 */
export async function updateDeliveryStatus(
  notificationId: string,
  userId: string,
  channel: 'inApp' | 'email' | 'sms' | 'push',
  status: Partial<DeliveryStatus>
): Promise<NotificationDocument | null> {
  const container = getNotificationsContainer();
  const notification = await findNotificationById(notificationId, userId);

  if (!notification) {
    return null;
  }

  const updated: NotificationDocument = {
    ...notification,
    channels: {
      ...notification.channels,
      [channel]: {
        ...notification.channels[channel],
        ...status,
      },
    },
  };

  const { resource } = await container.item(notificationId, userId).replace(updated);
  return (resource as unknown as NotificationDocument) || null;
}

