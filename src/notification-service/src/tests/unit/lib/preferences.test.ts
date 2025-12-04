/**
 * Preferences Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createDefaultPreferences,
  DEFAULT_CATEGORY_PREFERENCES,
} from '../../../models/NotificationPreferences';
import {
  getChannelPreferenceForCategory,
  isGloballyEnabled,
  isInQuietHours,
  filterChannelsByPreferences,
} from '../../../lib/preferencesRepository';
import { NotificationPreferencesDocument } from '../../../models/NotificationPreferences';

describe('preferencesRepository', () => {
  describe('createDefaultPreferences', () => {
    it('should create default preferences with required fields', () => {
      const result = createDefaultPreferences('user-123', 'user@example.com');
      assert.strictEqual(result.userId, 'user-123');
      assert.strictEqual(result.email, 'user@example.com');
      assert.strictEqual(result.globalEnabled, true);
    });

    it('should include phone if provided', () => {
      const result = createDefaultPreferences('user-123', 'user@example.com', '+971501234567');
      assert.strictEqual(result.phone, '+971501234567');
    });

    it('should include default channel preferences', () => {
      const result = createDefaultPreferences('user-123', 'user@example.com');
      assert.ok(result.channels);
      assert.ok(result.channels.approval);
      assert.ok(result.channels.security);
    });
  });

  describe('getChannelPreferenceForCategory', () => {
    const mockPreferences: NotificationPreferencesDocument = {
      id: 'pref-123',
      userId: 'user-123',
      email: 'user@example.com',
      globalEnabled: true,
      channels: DEFAULT_CATEGORY_PREFERENCES,
      updatedAt: new Date().toISOString(),
    };

    it('should return preferences for approval category', () => {
      const result = getChannelPreferenceForCategory(mockPreferences, 'approval');
      assert.strictEqual(result.inApp, true);
      assert.strictEqual(result.email, true);
      assert.strictEqual(result.push, true);
    });

    it('should return preferences for security category', () => {
      const result = getChannelPreferenceForCategory(mockPreferences, 'security');
      assert.strictEqual(result.inApp, true);
      assert.strictEqual(result.email, true);
      assert.strictEqual(result.sms, true);
      assert.strictEqual(result.push, true);
    });
  });

  describe('isGloballyEnabled', () => {
    it('should return true when enabled', () => {
      const prefs: NotificationPreferencesDocument = {
        id: 'pref-123',
        userId: 'user-123',
        email: 'user@example.com',
        globalEnabled: true,
        channels: DEFAULT_CATEGORY_PREFERENCES,
        updatedAt: new Date().toISOString(),
      };
      assert.strictEqual(isGloballyEnabled(prefs), true);
    });

    it('should return false when disabled', () => {
      const prefs: NotificationPreferencesDocument = {
        id: 'pref-123',
        userId: 'user-123',
        email: 'user@example.com',
        globalEnabled: false,
        channels: DEFAULT_CATEGORY_PREFERENCES,
        updatedAt: new Date().toISOString(),
      };
      assert.strictEqual(isGloballyEnabled(prefs), false);
    });
  });

  describe('isInQuietHours', () => {
    it('should return false when quiet hours not enabled', () => {
      const prefs: NotificationPreferencesDocument = {
        id: 'pref-123',
        userId: 'user-123',
        email: 'user@example.com',
        globalEnabled: true,
        channels: DEFAULT_CATEGORY_PREFERENCES,
        updatedAt: new Date().toISOString(),
      };
      assert.strictEqual(isInQuietHours(prefs), false);
    });

    it('should return false when quiet hours disabled', () => {
      const prefs: NotificationPreferencesDocument = {
        id: 'pref-123',
        userId: 'user-123',
        email: 'user@example.com',
        globalEnabled: true,
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '07:00',
          timezone: 'Asia/Dubai',
        },
        channels: DEFAULT_CATEGORY_PREFERENCES,
        updatedAt: new Date().toISOString(),
      };
      assert.strictEqual(isInQuietHours(prefs), false);
    });

    // Note: Testing actual quiet hours logic would require mocking Date
    // For now we just test the disabled cases
  });

  describe('filterChannelsByPreferences', () => {
    const mockPreferences: NotificationPreferencesDocument = {
      id: 'pref-123',
      userId: 'user-123',
      email: 'user@example.com',
      globalEnabled: true,
      channels: {
        ...DEFAULT_CATEGORY_PREFERENCES,
        assignment: { inApp: true, email: false, sms: false, push: false },
      },
      updatedAt: new Date().toISOString(),
    };

    it('should filter based on category preferences', () => {
      const result = filterChannelsByPreferences(
        ['inApp', 'email', 'sms', 'push'],
        mockPreferences,
        'assignment'
      );
      // Assignment only has inApp enabled
      assert.deepStrictEqual(result, ['inApp']);
    });

    it('should return all requested channels if enabled', () => {
      const result = filterChannelsByPreferences(
        ['inApp', 'email', 'push'],
        mockPreferences,
        'approval'
      );
      // Approval has inApp, email, push enabled
      assert.deepStrictEqual(result, ['inApp', 'email', 'push']);
    });

    it('should return only inApp when globally disabled', () => {
      const disabledPrefs: NotificationPreferencesDocument = {
        ...mockPreferences,
        globalEnabled: false,
      };
      const result = filterChannelsByPreferences(
        ['inApp', 'email', 'sms', 'push'],
        disabledPrefs,
        'approval'
      );
      assert.deepStrictEqual(result, ['inApp']);
    });
  });
});

