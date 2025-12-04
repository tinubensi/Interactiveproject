/**
 * Preferences Repository - CRUD operations for notification preferences
 */

import { v4 as uuidv4 } from 'uuid';
import { getPreferencesContainer } from './cosmosClient';
import {
  NotificationPreferencesDocument,
  UpdatePreferencesRequest,
  createDefaultPreferences,
  ChannelPreference,
} from '../models/NotificationPreferences';
import { NotificationCategory } from '../models/Notification';

/**
 * Find preferences by user ID
 */
export async function findPreferencesByUserId(
  userId: string
): Promise<NotificationPreferencesDocument | null> {
  const container = getPreferencesContainer();

  const { resources } = await container.items
    .query<NotificationPreferencesDocument>({
      query: 'SELECT * FROM c WHERE c.userId = @userId',
      parameters: [{ name: '@userId', value: userId }],
    })
    .fetchAll();

  return resources[0] || null;
}

/**
 * Get or create preferences for a user
 */
export async function getOrCreatePreferences(
  userId: string,
  email: string,
  phone?: string
): Promise<NotificationPreferencesDocument> {
  const existing = await findPreferencesByUserId(userId);
  
  if (existing) {
    return existing;
  }

  // Create default preferences
  const container = getPreferencesContainer();
  const defaults = createDefaultPreferences(userId, email, phone);

  const document: NotificationPreferencesDocument = {
    id: uuidv4(),
    ...defaults,
  };

  const { resource } = await container.items.create(document);

  if (!resource) {
    throw new Error('Failed to create preferences');
  }

  return resource;
}

/**
 * Update preferences
 */
export async function updatePreferences(
  userId: string,
  updates: UpdatePreferencesRequest
): Promise<NotificationPreferencesDocument> {
  const existing = await findPreferencesByUserId(userId);

  if (!existing) {
    throw new Error(`Preferences for user "${userId}" not found`);
  }

  const container = getPreferencesContainer();
  const now = new Date().toISOString();

  // Merge channel updates
  const updatedChannels = existing.channels;
  if (updates.channels) {
    for (const [category, prefs] of Object.entries(updates.channels)) {
      if (prefs && category in updatedChannels) {
        updatedChannels[category as keyof typeof updatedChannels] = {
          ...updatedChannels[category as keyof typeof updatedChannels],
          ...prefs,
        };
      }
    }
  }

  const updated: NotificationPreferencesDocument = {
    ...existing,
    globalEnabled: updates.globalEnabled ?? existing.globalEnabled,
    quietHours: updates.quietHours ?? existing.quietHours,
    channels: updatedChannels,
    digest: updates.digest ?? existing.digest,
    phone: updates.phone ?? existing.phone,
    updatedAt: now,
  };

  const { resource } = await container.item(existing.id, existing.userId).replace(updated);

  if (!resource) {
    throw new Error('Failed to update preferences');
  }

  return resource;
}

/**
 * Get channel preference for a category
 */
export function getChannelPreferenceForCategory(
  preferences: NotificationPreferencesDocument,
  category: NotificationCategory
): ChannelPreference {
  return preferences.channels[category];
}

/**
 * Check if notifications are globally enabled
 */
export function isGloballyEnabled(preferences: NotificationPreferencesDocument): boolean {
  return preferences.globalEnabled;
}

/**
 * Check if currently in quiet hours
 */
export function isInQuietHours(preferences: NotificationPreferencesDocument): boolean {
  if (!preferences.quietHours?.enabled) {
    return false;
  }

  const { start, end, timezone } = preferences.quietHours;

  // Get current time in user's timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  const currentTime = formatter.format(now);
  const [currentHour, currentMinute] = currentTime.split(':').map(Number);
  const currentMinutes = currentHour * 60 + currentMinute;

  const [startHour, startMinute] = start.split(':').map(Number);
  const startMinutes = startHour * 60 + startMinute;

  const [endHour, endMinute] = end.split(':').map(Number);
  const endMinutes = endHour * 60 + endMinute;

  // Handle overnight quiet hours (e.g., 22:00 to 07:00)
  if (startMinutes > endMinutes) {
    // Quiet hours span midnight
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  } else {
    // Quiet hours within same day
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
}

/**
 * Filter channels based on preferences
 */
export function filterChannelsByPreferences(
  requestedChannels: ('inApp' | 'email' | 'sms' | 'push')[],
  preferences: NotificationPreferencesDocument,
  category: NotificationCategory
): ('inApp' | 'email' | 'sms' | 'push')[] {
  // Check global enable
  if (!preferences.globalEnabled) {
    return ['inApp']; // Always send in-app
  }

  // Check quiet hours - skip external channels
  const inQuietHours = isInQuietHours(preferences);

  const categoryPrefs = getChannelPreferenceForCategory(preferences, category);

  return requestedChannels.filter((channel) => {
    // In-app always goes through
    if (channel === 'inApp') {
      return categoryPrefs.inApp;
    }

    // Skip external channels during quiet hours
    if (inQuietHours) {
      return false;
    }

    return categoryPrefs[channel];
  });
}

/**
 * Register push token
 */
export async function registerPushToken(
  userId: string,
  token: string,
  platform: 'web' | 'ios' | 'android',
  deviceName: string
): Promise<void> {
  const existing = await findPreferencesByUserId(userId);

  if (!existing) {
    throw new Error(`Preferences for user "${userId}" not found`);
  }

  const container = getPreferencesContainer();
  const now = new Date().toISOString();

  // Check if token already exists
  const tokens = existing.pushTokens || [];
  const existingTokenIndex = tokens.findIndex((t) => t.token === token);

  if (existingTokenIndex >= 0) {
    // Update existing token
    tokens[existingTokenIndex] = {
      token,
      platform,
      deviceName,
      lastUsed: now,
    };
  } else {
    // Add new token
    tokens.push({
      token,
      platform,
      deviceName,
      lastUsed: now,
    });
  }

  const updated: NotificationPreferencesDocument = {
    ...existing,
    pushTokens: tokens,
    updatedAt: now,
  };

  await container.item(existing.id, existing.userId).replace(updated);
}

/**
 * Remove push token
 */
export async function removePushToken(userId: string, token: string): Promise<void> {
  const existing = await findPreferencesByUserId(userId);

  if (!existing || !existing.pushTokens) {
    return;
  }

  const container = getPreferencesContainer();
  const now = new Date().toISOString();

  const updated: NotificationPreferencesDocument = {
    ...existing,
    pushTokens: existing.pushTokens.filter((t) => t.token !== token),
    updatedAt: now,
  };

  await container.item(existing.id, existing.userId).replace(updated);
}

