/**
 * PII Sanitizer Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  maskValue,
  partialMaskValue,
  hashValue,
  matchesField,
  sanitizeField,
  sanitizePII,
  sanitizeChanges,
  containsPII,
  PIIConfig,
} from '../../../lib/piiSanitizer';

const testConfig: PIIConfig = {
  fieldsToMask: ['ssn', 'password', 'creditCard', 'token'],
  fieldsToPartialMask: ['phone', 'emiratesId'],
  fieldsToHash: ['email'],
  maskPattern: '***MASKED***',
};

describe('piiSanitizer', () => {
  describe('maskValue', () => {
    it('should return the mask pattern', () => {
      assert.strictEqual(maskValue('***MASKED***'), '***MASKED***');
    });
  });

  describe('partialMaskValue', () => {
    it('should show last 4 characters', () => {
      assert.strictEqual(partialMaskValue('+971501234567'), '****4567');
    });

    it('should handle short values', () => {
      assert.strictEqual(partialMaskValue('123'), '****');
    });

    it('should handle empty string', () => {
      assert.strictEqual(partialMaskValue(''), '****');
    });
  });

  describe('hashValue', () => {
    it('should return consistent hash for same input', () => {
      const hash1 = hashValue('test@example.com');
      const hash2 = hashValue('test@example.com');
      assert.strictEqual(hash1, hash2);
    });

    it('should return different hash for different input', () => {
      const hash1 = hashValue('user1@example.com');
      const hash2 = hashValue('user2@example.com');
      assert.notStrictEqual(hash1, hash2);
    });

    it('should be case-insensitive', () => {
      const hash1 = hashValue('Test@Example.com');
      const hash2 = hashValue('test@example.com');
      assert.strictEqual(hash1, hash2);
    });

    it('should return 16 character hash', () => {
      const hash = hashValue('test@example.com');
      assert.strictEqual(hash.length, 16);
    });
  });

  describe('matchesField', () => {
    it('should match exact field names (case-insensitive)', () => {
      assert.strictEqual(matchesField('email', ['email']), true);
      assert.strictEqual(matchesField('Email', ['email']), true);
      assert.strictEqual(matchesField('EMAIL', ['email']), true);
    });

    it('should match partial field names', () => {
      assert.strictEqual(matchesField('userEmail', ['email']), true);
      assert.strictEqual(matchesField('emailAddress', ['email']), true);
    });

    it('should not match unrelated fields', () => {
      assert.strictEqual(matchesField('username', ['email']), false);
      assert.strictEqual(matchesField('phone', ['email']), false);
    });
  });

  describe('sanitizeField', () => {
    it('should completely mask SSN', () => {
      const result = sanitizeField('ssn', '123-45-6789', testConfig);
      assert.strictEqual(result, '***MASKED***');
    });

    it('should completely mask password', () => {
      const result = sanitizeField('password', 'secretpassword123', testConfig);
      assert.strictEqual(result, '***MASKED***');
    });

    it('should partially mask phone number', () => {
      const result = sanitizeField('phone', '+971501234567', testConfig);
      assert.strictEqual(result, '****4567');
    });

    it('should partially mask Emirates ID', () => {
      const result = sanitizeField('emiratesId', '784-1234-5678901-2', testConfig);
      assert.strictEqual(result, '****01-2');
    });

    it('should hash email', () => {
      const result = sanitizeField('email', 'user@example.com', testConfig);
      assert.notStrictEqual(result, 'user@example.com');
      assert.strictEqual(typeof result, 'string');
      assert.strictEqual((result as string).length, 16);
    });

    it('should pass through non-PII fields', () => {
      const result = sanitizeField('name', 'John Doe', testConfig);
      assert.strictEqual(result, 'John Doe');
    });

    it('should handle null values', () => {
      const result = sanitizeField('ssn', null, testConfig);
      assert.strictEqual(result, null);
    });

    it('should handle undefined values', () => {
      const result = sanitizeField('ssn', undefined, testConfig);
      assert.strictEqual(result, undefined);
    });
  });

  describe('sanitizePII', () => {
    it('should sanitize flat object', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+971501234567',
        ssn: '123-45-6789',
      };

      const result = sanitizePII(data, testConfig) as Record<string, unknown>;

      assert.strictEqual(result.name, 'John Doe');
      assert.notStrictEqual(result.email, 'john@example.com');
      assert.strictEqual(result.phone, '****4567');
      assert.strictEqual(result.ssn, '***MASKED***');
    });

    it('should sanitize nested object', () => {
      const data = {
        customer: {
          name: 'John Doe',
          contact: {
            email: 'john@example.com',
            phone: '+971501234567',
          },
        },
      };

      const result = sanitizePII(data, testConfig) as Record<string, unknown>;
      const customer = result.customer as Record<string, unknown>;
      const contact = customer.contact as Record<string, unknown>;

      assert.strictEqual(customer.name, 'John Doe');
      assert.notStrictEqual(contact.email, 'john@example.com');
      assert.strictEqual(contact.phone, '****4567');
    });

    it('should sanitize arrays', () => {
      const data = {
        users: [
          { email: 'user1@example.com', phone: '+971501111111' },
          { email: 'user2@example.com', phone: '+971502222222' },
        ],
      };

      const result = sanitizePII(data, testConfig) as Record<string, unknown>;
      const users = result.users as Array<Record<string, unknown>>;

      assert.strictEqual(users[0].phone, '****1111');
      assert.strictEqual(users[1].phone, '****2222');
    });

    it('should handle null input', () => {
      const result = sanitizePII(null, testConfig);
      assert.strictEqual(result, null);
    });

    it('should handle undefined input', () => {
      const result = sanitizePII(undefined, testConfig);
      assert.strictEqual(result, undefined);
    });

    it('should handle primitive values', () => {
      assert.strictEqual(sanitizePII('string', testConfig), 'string');
      assert.strictEqual(sanitizePII(123, testConfig), 123);
      assert.strictEqual(sanitizePII(true, testConfig), true);
    });
  });

  describe('sanitizeChanges', () => {
    it('should sanitize before and after states', () => {
      const changes = {
        before: { email: 'old@example.com', phone: '+971501111111' },
        after: { email: 'new@example.com', phone: '+971502222222' },
        changedFields: ['email', 'phone'],
      };

      const result = sanitizeChanges(changes, testConfig);

      assert.ok(result);
      assert.notStrictEqual(result?.before?.email, 'old@example.com');
      assert.notStrictEqual(result?.after?.email, 'new@example.com');
      assert.strictEqual(result?.before?.phone, '****1111');
      assert.strictEqual(result?.after?.phone, '****2222');
      assert.deepStrictEqual(result?.changedFields, ['email', 'phone']);
    });

    it('should handle undefined changes', () => {
      const result = sanitizeChanges(undefined, testConfig);
      assert.strictEqual(result, undefined);
    });

    it('should handle partial changes', () => {
      const changes = {
        after: { name: 'New Name' },
        changedFields: ['name'],
      };

      const result = sanitizeChanges(changes, testConfig);

      assert.ok(result);
      assert.strictEqual(result?.before, undefined);
      assert.strictEqual(result?.after?.name, 'New Name');
    });
  });

  describe('containsPII', () => {
    it('should detect PII in flat object', () => {
      const withPII = { name: 'John', email: 'john@example.com' };
      const withoutPII = { name: 'John', age: 30 };

      assert.strictEqual(containsPII(withPII, testConfig), true);
      assert.strictEqual(containsPII(withoutPII, testConfig), false);
    });

    it('should detect PII in nested object', () => {
      const data = {
        customer: {
          profile: {
            ssn: '123-45-6789',
          },
        },
      };

      assert.strictEqual(containsPII(data, testConfig), true);
    });

    it('should detect PII in arrays', () => {
      const data = {
        contacts: [
          { type: 'home', phone: '+971501234567' },
        ],
      };

      assert.strictEqual(containsPII(data, testConfig), true);
    });

    it('should return false for null/undefined', () => {
      assert.strictEqual(containsPII(null, testConfig), false);
      assert.strictEqual(containsPII(undefined, testConfig), false);
    });
  });
});

