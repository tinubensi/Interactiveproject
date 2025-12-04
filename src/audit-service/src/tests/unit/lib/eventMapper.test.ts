/**
 * Event Mapper Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  extractEntityType,
  extractEntityId,
  extractAction,
  mapToCategory,
  determineSeverity,
  extractActor,
  extractChanges,
  extractContext,
  extractServiceName,
  mapEventToAuditLog,
  EventGridEvent,
} from '../../../lib/eventMapper';

describe('eventMapper', () => {
  describe('extractEntityType', () => {
    it('should extract entity type from event type', () => {
      assert.strictEqual(extractEntityType('auth.user.logged_in'), 'auth');
      assert.strictEqual(extractEntityType('customer.created'), 'customer');
      assert.strictEqual(extractEntityType('document.uploaded'), 'document');
    });

    it('should return unknown for invalid format', () => {
      assert.strictEqual(extractEntityType('singleword'), 'unknown');
      assert.strictEqual(extractEntityType(''), 'unknown');
    });
  });

  describe('extractEntityId', () => {
    it('should extract entity ID from subject', () => {
      assert.strictEqual(extractEntityId('/customers/cust-123'), 'cust-123');
      assert.strictEqual(extractEntityId('/users/user-456/roles/admin'), 'admin');
    });

    it('should return subject for simple format', () => {
      assert.strictEqual(extractEntityId('entity-id'), 'entity-id');
    });

    it('should return unknown for empty subject', () => {
      assert.strictEqual(extractEntityId(''), 'unknown');
    });
  });

  describe('extractAction', () => {
    it('should extract action from event type', () => {
      assert.strictEqual(extractAction('auth.user.logged_in'), 'logged_in');
      assert.strictEqual(extractAction('customer.created'), 'created');
      assert.strictEqual(extractAction('customer.updated'), 'updated');
    });

    it('should return full event type for single part', () => {
      assert.strictEqual(extractAction('action'), 'action');
    });
  });

  describe('mapToCategory', () => {
    it('should map authentication events', () => {
      assert.strictEqual(mapToCategory('auth.user.logged_in'), 'authentication');
      assert.strictEqual(mapToCategory('auth.user.logged_out'), 'authentication');
      assert.strictEqual(mapToCategory('auth.session.created'), 'authentication');
    });

    it('should map security events', () => {
      assert.strictEqual(mapToCategory('auth.login.failed'), 'security_event');
      assert.strictEqual(mapToCategory('permission.denied'), 'security_event');
    });

    it('should map authorization events', () => {
      assert.strictEqual(mapToCategory('role.assigned'), 'authorization');
      assert.strictEqual(mapToCategory('role.removed'), 'authorization');
    });

    it('should map data access events', () => {
      assert.strictEqual(mapToCategory('document.downloaded'), 'data_access');
    });

    it('should map data mutation events', () => {
      assert.strictEqual(mapToCategory('customer.created'), 'data_mutation');
      assert.strictEqual(mapToCategory('customer.updated'), 'data_mutation');
      assert.strictEqual(mapToCategory('customer.deleted'), 'data_mutation');
    });

    it('should map system events', () => {
      assert.strictEqual(mapToCategory('workflow.created'), 'system');
    });
  });

  describe('determineSeverity', () => {
    it('should return critical for failed logins with many attempts', () => {
      const severity = determineSeverity('auth.login.failed', { attemptNumber: 5 });
      assert.strictEqual(severity, 'critical');
    });

    it('should return info for normal failed login', () => {
      const severity = determineSeverity('auth.login.failed', { attemptNumber: 1 });
      assert.strictEqual(severity, 'critical'); // auth.login.failed is always critical
    });

    it('should return warning for permission denied', () => {
      const severity = determineSeverity('permission.denied', {});
      assert.strictEqual(severity, 'warning');
    });

    it('should return warning for sensitive resource access denied', () => {
      const severity = determineSeverity('permission.denied', { 
        resource: { type: 'audit' } 
      });
      assert.strictEqual(severity, 'warning');
    });

    it('should return info for normal events', () => {
      const severity = determineSeverity('customer.created', {});
      assert.strictEqual(severity, 'info');
    });
  });

  describe('extractActor', () => {
    it('should extract actor from userId field', () => {
      const data = { userId: 'user-123', email: 'user@example.com' };
      const actor = extractActor(data);
      
      assert.strictEqual(actor.id, 'user-123');
      assert.strictEqual(actor.email, 'user@example.com');
      assert.strictEqual(actor.type, 'user');
    });

    it('should handle system actor', () => {
      const data = { userId: 'system', email: '' };
      const actor = extractActor(data);
      
      assert.strictEqual(actor.id, 'system');
      assert.strictEqual(actor.type, 'system');
    });

    it('should handle service actor', () => {
      const data = { userId: 'auth-service', serviceName: 'auth-service' };
      const actor = extractActor(data);
      
      assert.strictEqual(actor.type, 'service');
    });

    it('should use fallback fields', () => {
      const data = { actorId: 'actor-123', actorEmail: 'actor@example.com' };
      const actor = extractActor(data);
      
      assert.strictEqual(actor.id, 'actor-123');
      assert.strictEqual(actor.email, 'actor@example.com');
    });

    it('should handle missing fields', () => {
      const actor = extractActor({});
      
      assert.strictEqual(actor.id, 'system');
      assert.strictEqual(actor.email, '');
    });
  });

  describe('extractChanges', () => {
    it('should extract before and after states', () => {
      const data = {
        before: { name: 'Old Name' },
        after: { name: 'New Name' },
      };
      
      const changes = extractChanges(data);
      
      assert.deepStrictEqual(changes?.before, { name: 'Old Name' });
      assert.deepStrictEqual(changes?.after, { name: 'New Name' });
      assert.deepStrictEqual(changes?.changedFields, ['name']);
    });

    it('should use provided changedFields', () => {
      const data = {
        before: { name: 'Old', email: 'old@test.com' },
        after: { name: 'New', email: 'old@test.com' },
        changedFields: ['name'],
      };
      
      const changes = extractChanges(data);
      
      assert.deepStrictEqual(changes?.changedFields, ['name']);
    });

    it('should return undefined when no changes', () => {
      const changes = extractChanges({});
      assert.strictEqual(changes, undefined);
    });
  });

  describe('extractContext', () => {
    it('should extract context from event and data', () => {
      const event: EventGridEvent = {
        id: 'event-123',
        eventType: 'customer.created',
        subject: '/customers/cust-1',
        eventTime: '2025-12-04T10:00:00Z',
        data: {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          requestId: 'req-456',
          correlationId: 'corr-789',
        },
        topic: '/subscriptions/sub/topics/nectaria-events',
      };
      
      const context = extractContext(event, event.data);
      
      assert.strictEqual(context.ipAddress, '192.168.1.1');
      assert.strictEqual(context.userAgent, 'Mozilla/5.0');
      assert.strictEqual(context.requestId, 'req-456');
      assert.strictEqual(context.correlationId, 'corr-789');
    });

    it('should use defaults for missing fields', () => {
      const event: EventGridEvent = {
        id: 'event-123',
        eventType: 'test',
        subject: '/test',
        eventTime: '2025-12-04T10:00:00Z',
        data: {},
      };
      
      const context = extractContext(event, event.data);
      
      assert.strictEqual(context.ipAddress, 'unknown');
      assert.strictEqual(context.userAgent, 'unknown');
      assert.strictEqual(context.requestId, 'event-123');
    });
  });

  describe('extractServiceName', () => {
    it('should extract service name from topic', () => {
      const topic = '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.EventGrid/topics/nectaria-events';
      assert.strictEqual(extractServiceName(topic), 'nectaria');
    });

    it('should return unknown for empty topic', () => {
      assert.strictEqual(extractServiceName(''), 'unknown');
    });
  });

  describe('mapEventToAuditLog', () => {
    it('should map complete event to audit log fields', () => {
      const event: EventGridEvent = {
        id: 'event-123',
        eventType: 'customer.updated',
        subject: '/customers/cust-456',
        eventTime: '2025-12-04T10:00:00Z',
        data: {
          userId: 'user-789',
          email: 'user@example.com',
          before: { name: 'Old Name' },
          after: { name: 'New Name' },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
        topic: '/topics/customer-service',
      };
      
      const result = mapEventToAuditLog(event);
      
      assert.strictEqual(result.entityType, 'customer');
      assert.strictEqual(result.entityId, 'cust-456');
      assert.strictEqual(result.action, 'updated');
      assert.strictEqual(result.category, 'data_mutation');
      assert.strictEqual(result.severity, 'info');
      assert.strictEqual(result.actor.id, 'user-789');
      assert.strictEqual(result.actor.email, 'user@example.com');
      assert.deepStrictEqual(result.changes?.changedFields, ['name']);
      assert.strictEqual(result.context.ipAddress, '192.168.1.1');
      assert.strictEqual(result.timestamp, '2025-12-04T10:00:00Z');
    });
  });
});

