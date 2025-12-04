/**
 * Channel Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateEmail } from '../../../lib/channels/emailChannel';
import { validatePhoneNumber, truncateToSmsLimit } from '../../../lib/channels/smsChannel';
import { formatPushPayload } from '../../../lib/channels/pushChannel';

describe('emailChannel', () => {
  describe('validateEmail', () => {
    it('should accept valid email', () => {
      assert.strictEqual(validateEmail('test@example.com'), true);
    });

    it('should accept email with subdomain', () => {
      assert.strictEqual(validateEmail('user@mail.example.com'), true);
    });

    it('should accept email with plus sign', () => {
      assert.strictEqual(validateEmail('user+tag@example.com'), true);
    });

    it('should reject email without @', () => {
      assert.strictEqual(validateEmail('testexample.com'), false);
    });

    it('should reject email without domain', () => {
      assert.strictEqual(validateEmail('test@'), false);
    });

    it('should reject email with spaces', () => {
      assert.strictEqual(validateEmail('test @example.com'), false);
    });
  });
});

describe('smsChannel', () => {
  describe('validatePhoneNumber', () => {
    it('should accept valid phone with country code', () => {
      assert.strictEqual(validatePhoneNumber('+971501234567'), true);
    });

    it('should accept phone with dashes', () => {
      assert.strictEqual(validatePhoneNumber('+971-50-123-4567'), true);
    });

    it('should accept phone with spaces', () => {
      assert.strictEqual(validatePhoneNumber('+971 50 123 4567'), true);
    });

    it('should reject phone without country code', () => {
      assert.strictEqual(validatePhoneNumber('0501234567'), false);
    });

    it('should reject short phone numbers', () => {
      assert.strictEqual(validatePhoneNumber('+12345'), false);
    });
  });

  describe('truncateToSmsLimit', () => {
    it('should not truncate short messages', () => {
      const message = 'Short message';
      const result = truncateToSmsLimit(message);
      assert.strictEqual(result.text, message);
      assert.strictEqual(result.truncated, false);
    });

    it('should truncate to 160 characters', () => {
      const message = 'A'.repeat(200);
      const result = truncateToSmsLimit(message);
      assert.strictEqual(result.text.length, 160);
      assert.strictEqual(result.truncated, true);
    });

    it('should add ellipsis when truncated', () => {
      const message = 'A'.repeat(200);
      const result = truncateToSmsLimit(message);
      assert.ok(result.text.endsWith('...'));
    });

    it('should not truncate exactly 160 chars', () => {
      const message = 'A'.repeat(160);
      const result = truncateToSmsLimit(message);
      assert.strictEqual(result.text, message);
      assert.strictEqual(result.truncated, false);
    });
  });
});

describe('pushChannel', () => {
  describe('formatPushPayload', () => {
    it('should format basic payload', () => {
      const result = formatPushPayload('Title', 'Body');
      assert.deepStrictEqual(result, {
        notification: { title: 'Title', body: 'Body' },
        data: {},
      });
    });

    it('should include data', () => {
      const result = formatPushPayload('Title', 'Body', { key: 'value' });
      assert.deepStrictEqual(result, {
        notification: { title: 'Title', body: 'Body' },
        data: { key: 'value' },
      });
    });
  });
});

