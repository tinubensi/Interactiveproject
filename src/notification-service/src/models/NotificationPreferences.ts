/**
 * Notification Preferences Model - stored in Cosmos DB preferences container
 * Partition Key: /userId
 */

import { NotificationCategory } from './Notification';

/**
 * Channel preference for a category
 */
export interface ChannelPreference {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
}

/**
 * Quiet hours configuration
 */
export interface QuietHours {
  enabled: boolean;
  start: string; // "22:00" (local time)
  end: string;   // "07:00"
  timezone: string; // "Asia/Dubai"
}

/**
 * Push notification token
 */
export interface PushToken {
  token: string;
  platform: 'web' | 'ios' | 'android';
  deviceName: string;
  lastUsed: string;
}

/**
 * Digest settings
 */
export interface DigestSettings {
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  dayOfWeek?: number; // 0-6 for weekly
  timeOfDay: string;  // "09:00"
  categories: NotificationCategory[];
}

/**
 * Channel preferences by category
 */
export interface CategoryChannelPreferences {
  approval: ChannelPreference;
  assignment: ChannelPreference;
  reminder: ChannelPreference;
  alert: ChannelPreference;
  update: ChannelPreference;
  security: ChannelPreference;
  compliance: ChannelPreference;
  system: ChannelPreference;
}

/**
 * Notification Preferences Document
 */
export interface NotificationPreferencesDocument {
  /** Document ID (UUID) */
  id: string;

  /** User ID - Partition key */
  userId: string;

  /** User email */
  email: string;

  /** User phone for SMS */
  phone?: string;

  /** Global enable/disable */
  globalEnabled: boolean;

  /** Quiet hours settings */
  quietHours?: QuietHours;

  /** Channel preferences by category */
  channels: CategoryChannelPreferences;

  /** Digest settings */
  digest?: DigestSettings;

  /** Push notification tokens */
  pushTokens?: PushToken[];

  /** Updated timestamp */
  updatedAt: string;
}

/**
 * Update preferences request
 */
export interface UpdatePreferencesRequest {
  globalEnabled?: boolean;
  quietHours?: QuietHours;
  channels?: Partial<CategoryChannelPreferences>;
  digest?: DigestSettings;
  phone?: string;
}

/**
 * Default channel preferences
 */
export const DEFAULT_CHANNEL_PREFERENCE: ChannelPreference = {
  inApp: true,
  email: true,
  sms: false,
  push: false,
};

/**
 * Default category preferences
 */
export const DEFAULT_CATEGORY_PREFERENCES: CategoryChannelPreferences = {
  approval: { inApp: true, email: true, sms: false, push: true },
  assignment: { inApp: true, email: false, sms: false, push: false },
  reminder: { inApp: true, email: true, sms: false, push: false },
  alert: { inApp: true, email: true, sms: true, push: true },
  update: { inApp: true, email: false, sms: false, push: false },
  security: { inApp: true, email: true, sms: true, push: true },
  compliance: { inApp: true, email: true, sms: false, push: false },
  system: { inApp: true, email: false, sms: false, push: false },
};

/**
 * Create default preferences for a user
 */
export function createDefaultPreferences(
  userId: string,
  email: string,
  phone?: string
): Omit<NotificationPreferencesDocument, 'id'> {
  return {
    userId,
    email,
    phone,
    globalEnabled: true,
    channels: { ...DEFAULT_CATEGORY_PREFERENCES },
    updatedAt: new Date().toISOString(),
  };
}

