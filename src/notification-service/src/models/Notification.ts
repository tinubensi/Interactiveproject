/**
 * Notification Model - stored in Cosmos DB notifications container
 * Partition Key: /userId
 * TTL: 90 days
 */

/**
 * Notification types
 */
export type NotificationType =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'action_required';

/**
 * Notification categories
 */
export type NotificationCategory =
  | 'approval'
  | 'assignment'
  | 'reminder'
  | 'alert'
  | 'update'
  | 'security'
  | 'compliance'
  | 'system';

/**
 * Notification priority
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Delivery status for a channel
 */
export interface DeliveryStatus {
  sent: boolean;
  sentAt?: string;
  delivered?: boolean;
  deliveredAt?: string;
  failed?: boolean;
  failureReason?: string;
}

/**
 * Notification source
 */
export interface NotificationSource {
  service: string;
  entityType?: string;
  entityId?: string;
  eventType?: string;
}

/**
 * Notification action
 */
export interface NotificationAction {
  type: 'link' | 'button' | 'deeplink';
  label: string;
  url: string;
  data?: Record<string, unknown>;
}

/**
 * Channel delivery statuses
 */
export interface ChannelDeliveryStatus {
  inApp: DeliveryStatus;
  email?: DeliveryStatus;
  sms?: DeliveryStatus;
  push?: DeliveryStatus;
}

/**
 * Notification Document
 */
export interface NotificationDocument {
  /** Document ID (UUID) */
  id: string;

  /** Notification ID (same as id) */
  notificationId: string;

  /** User ID - Partition key */
  userId: string;

  /** Notification type */
  type: NotificationType;

  /** Title */
  title: string;

  /** Short message */
  message: string;

  /** Extended content (HTML allowed) */
  body?: string;

  /** Category for filtering/preferences */
  category: NotificationCategory;

  /** Priority */
  priority: NotificationPriority;

  /** Source information */
  source: NotificationSource;

  /** Delivery status per channel */
  channels: ChannelDeliveryStatus;

  /** Optional action */
  action?: NotificationAction;

  /** Read status */
  isRead: boolean;

  /** Read timestamp */
  readAt?: string;

  /** Group ID for grouped notifications */
  groupId?: string;

  /** Thread ID for conversation threads */
  threadId?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;

  /** Created timestamp */
  createdAt: string;

  /** Expiry timestamp */
  expiresAt?: string;

  /** TTL in seconds (90 days = 7776000) */
  ttl: number;
}

/**
 * Send notification request
 */
export interface SendNotificationRequest {
  templateId: string;
  recipients: string[];
  variables: Record<string, unknown>;
  channels?: ('inApp' | 'email' | 'sms' | 'push')[];
  priority?: NotificationPriority;
  source: NotificationSource;
  scheduledFor?: string;
  groupId?: string;
  threadId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Send result for single recipient
 */
export interface RecipientSendResult {
  notificationId: string;
  userId: string;
  channels: ChannelDeliveryStatus;
}

/**
 * Send notification response
 */
export interface SendNotificationResponse {
  notifications: RecipientSendResult[];
  summary: {
    total: number;
    sent: number;
    failed: number;
  };
}

/**
 * User notifications query
 */
export interface UserNotificationsQuery {
  category?: NotificationCategory;
  isRead?: boolean;
  limit?: number;
  continuationToken?: string;
}

/**
 * User notifications response
 */
export interface UserNotificationsResponse {
  notifications: NotificationSummary[];
  unreadCount: number;
  continuationToken?: string;
}

/**
 * Notification summary (for list responses)
 */
export interface NotificationSummary {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  action?: NotificationAction;
  source: NotificationSource;
}

/**
 * Unread count response
 */
export interface UnreadCountResponse {
  total: number;
  byCategory: Record<NotificationCategory, number>;
  byPriority: Record<NotificationPriority, number>;
}

/**
 * Default TTL in seconds (90 days)
 */
export const DEFAULT_TTL_SECONDS = 90 * 24 * 60 * 60; // 7776000

