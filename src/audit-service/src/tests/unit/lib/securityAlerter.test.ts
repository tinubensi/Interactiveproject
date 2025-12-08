/**
 * Security Alerter Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  isCriticalSecurityEvent,
  generateSecurityAlert,
  isHighPrivilegeRole,
  isSensitiveResource,
} from '../../../lib/securityAlerter';
import { EventGridEvent } from '../../../lib/eventMapper';

describe('securityAlerter', () => {
  describe('isCriticalSecurityEvent', () => {
    it('should detect brute force attempt', () => {
      const event: EventGridEvent = {
        id: 'event-1',
        eventType: 'auth.login.failed',
        subject: '/auth/login',
        eventTime: '2025-12-04T10:00:00Z',
        data: {
          email: 'user@example.com',
          attemptNumber: 5,
          ipAddress: '192.168.1.1',
        },
      };

      assert.strictEqual(isCriticalSecurityEvent(event), true);
    });

    it('should not flag single failed login', () => {
      const event: EventGridEvent = {
        id: 'event-1',
        eventType: 'auth.login.failed',
        subject: '/auth/login',
        eventTime: '2025-12-04T10:00:00Z',
        data: {
          email: 'user@example.com',
          attemptNumber: 1,
        },
      };

      assert.strictEqual(isCriticalSecurityEvent(event), false);
    });

    it('should detect sensitive resource access denied', () => {
      const event: EventGridEvent = {
        id: 'event-1',
        eventType: 'permission.denied',
        subject: '/permissions',
        eventTime: '2025-12-04T10:00:00Z',
        data: {
          userId: 'user-123',
          resource: { type: 'audit' },
          permission: 'audit:read',
        },
      };

      assert.strictEqual(isCriticalSecurityEvent(event), true);
    });

    it('should not flag normal permission denied', () => {
      const event: EventGridEvent = {
        id: 'event-1',
        eventType: 'permission.denied',
        subject: '/permissions',
        eventTime: '2025-12-04T10:00:00Z',
        data: {
          userId: 'user-123',
          resource: { type: 'customer' },
          permission: 'customers:read',
        },
      };

      assert.strictEqual(isCriticalSecurityEvent(event), false);
    });

    it('should detect high privilege role assignment', () => {
      const event: EventGridEvent = {
        id: 'event-1',
        eventType: 'role.assigned',
        subject: '/users/user-123/roles',
        eventTime: '2025-12-04T10:00:00Z',
        data: {
          userId: 'user-123',
          roleId: 'super-admin',
          assignedBy: 'admin-456',
        },
      };

      assert.strictEqual(isCriticalSecurityEvent(event), true);
    });

    it('should not flag normal role assignment', () => {
      const event: EventGridEvent = {
        id: 'event-1',
        eventType: 'role.assigned',
        subject: '/users/user-123/roles',
        eventTime: '2025-12-04T10:00:00Z',
        data: {
          userId: 'user-123',
          roleId: 'junior-broker',
          assignedBy: 'admin-456',
        },
      };

      assert.strictEqual(isCriticalSecurityEvent(event), false);
    });

    it('should detect token reuse attack', () => {
      const event: EventGridEvent = {
        id: 'event-1',
        eventType: 'auth.user.logged_out',
        subject: '/auth/logout',
        eventTime: '2025-12-04T10:00:00Z',
        data: {
          userId: 'user-123',
          logoutType: 'token_reuse_detected',
          ipAddress: '192.168.1.1',
        },
      };

      assert.strictEqual(isCriticalSecurityEvent(event), true);
    });

    it('should not flag normal logout', () => {
      const event: EventGridEvent = {
        id: 'event-1',
        eventType: 'auth.user.logged_out',
        subject: '/auth/logout',
        eventTime: '2025-12-04T10:00:00Z',
        data: {
          userId: 'user-123',
          logoutType: 'user_initiated',
        },
      };

      assert.strictEqual(isCriticalSecurityEvent(event), false);
    });
  });

  describe('generateSecurityAlert', () => {
    it('should generate alert for brute force attempt', () => {
      const event: EventGridEvent = {
        id: 'event-1',
        eventType: 'auth.login.failed',
        subject: '/auth/login',
        eventTime: '2025-12-04T10:00:00Z',
        data: {
          email: 'user@example.com',
          attemptNumber: 5,
          ipAddress: '192.168.1.1',
        },
      };

      const alert = generateSecurityAlert(event);

      assert.ok(alert);
      assert.strictEqual(alert.alertType, 'brute_force_attempt');
      assert.strictEqual(alert.severity, 'critical');
      assert.ok(alert.title.includes('Failed Login'));
      assert.ok(alert.description.includes('192.168.1.1'));
      assert.ok(alert.description.includes('user@example.com'));
      assert.strictEqual(alert.sourceEvent.type, 'auth.login.failed');
      assert.strictEqual(alert.sourceEvent.id, 'event-1');
    });

    it('should generate alert for high privilege role assignment', () => {
      const event: EventGridEvent = {
        id: 'event-2',
        eventType: 'role.assigned',
        subject: '/users/user-123/roles',
        eventTime: '2025-12-04T10:00:00Z',
        data: {
          userId: 'user-123',
          roleId: 'compliance-officer',
          assignedBy: 'admin-456',
        },
      };

      const alert = generateSecurityAlert(event);

      assert.ok(alert);
      assert.strictEqual(alert.alertType, 'high_privilege_role_assigned');
      assert.strictEqual(alert.severity, 'high');
      assert.ok(alert.description.includes('compliance-officer'));
      assert.ok(alert.description.includes('user-123'));
    });

    it('should return null for non-critical event', () => {
      const event: EventGridEvent = {
        id: 'event-1',
        eventType: 'customer.created',
        subject: '/customers/cust-1',
        eventTime: '2025-12-04T10:00:00Z',
        data: {},
      };

      const alert = generateSecurityAlert(event);
      assert.strictEqual(alert, null);
    });
  });

  describe('isHighPrivilegeRole', () => {
    it('should identify high privilege roles', () => {
      assert.strictEqual(isHighPrivilegeRole('super-admin'), true);
      assert.strictEqual(isHighPrivilegeRole('compliance-officer'), true);
      assert.strictEqual(isHighPrivilegeRole('broker-manager'), true);
    });

    it('should not flag normal roles', () => {
      assert.strictEqual(isHighPrivilegeRole('junior-broker'), false);
      assert.strictEqual(isHighPrivilegeRole('senior-broker'), false);
      assert.strictEqual(isHighPrivilegeRole('customer'), false);
    });
  });

  describe('isSensitiveResource', () => {
    it('should identify sensitive resources', () => {
      assert.strictEqual(isSensitiveResource('audit'), true);
      assert.strictEqual(isSensitiveResource('compliance'), true);
      assert.strictEqual(isSensitiveResource('financial'), true);
    });

    it('should not flag normal resources', () => {
      assert.strictEqual(isSensitiveResource('customer'), false);
      assert.strictEqual(isSensitiveResource('lead'), false);
      assert.strictEqual(isSensitiveResource('document'), false);
    });
  });
});

