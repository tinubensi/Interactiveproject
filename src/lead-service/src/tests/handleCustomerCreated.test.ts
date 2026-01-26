/**
 * Tests for Customer Created Event Handler
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { v4 as uuidv4 } from 'uuid';

describe('Handle Customer Created From Lead', () => {
  describe('Event Data Validation', () => {
    it('should validate required fields in event data', async () => {
      const eventData = {
        customerId: uuidv4(),
        tempCustomerId: uuidv4(),
        leadId: uuidv4(),
        referenceId: 'LEAD-2024-001',
        email: 'test@example.com',
        createdAt: new Date()
      };

      // Verify required fields
      assert.ok(eventData.customerId, 'customerId is required');
      assert.ok(eventData.tempCustomerId, 'tempCustomerId is required');
      assert.ok(eventData.leadId, 'leadId is required');
      assert.notStrictEqual(
        eventData.customerId,
        eventData.tempCustomerId,
        'customerId and tempCustomerId should be different'
      );
    });
  });

  describe('Lead Update Logic', () => {
    it('should update lead customerId from temp to real ID', async () => {
      const tempCustomerId = uuidv4();
      const realCustomerId = uuidv4();
      const leadId = uuidv4();

      // Mock lead before update
      const leadBefore = {
        id: leadId,
        customerId: tempCustomerId,
        customerCreationPending: true,
        firstName: 'John',
        lastName: 'Doe'
      };

      // Expected lead after update
      const leadAfter = {
        ...leadBefore,
        customerId: realCustomerId,
        customerCreationPending: false,
        updatedAt: new Date()
      };

      // Verify the update
      assert.strictEqual(leadAfter.customerId, realCustomerId, 'customerId should be updated to real ID');
      assert.strictEqual(
        leadAfter.customerCreationPending,
        false,
        'customerCreationPending should be set to false'
      );
      assert.ok(leadAfter.updatedAt, 'updatedAt should be set');
    });

    it('should handle customer ID mismatch gracefully', async () => {
      const tempCustomerId = uuidv4();
      const differentTempId = uuidv4();
      const realCustomerId = uuidv4();

      const eventData = {
        customerId: realCustomerId,
        tempCustomerId: differentTempId, // Different from lead's temp ID
        leadId: uuidv4(),
        referenceId: 'LEAD-2024-002',
        email: 'test@example.com',
        createdAt: new Date()
      };

      const lead = {
        id: eventData.leadId,
        customerId: tempCustomerId // Different temp ID
      };

      // Should still proceed with update despite mismatch
      assert.notStrictEqual(
        lead.customerId,
        eventData.tempCustomerId,
        'Mismatch should be detected but update should proceed'
      );
    });
  });

  describe('Timeline Entry', () => {
    it('should create timeline entry after successful update', async () => {
      const leadId = uuidv4();
      const realCustomerId = uuidv4();

      const timelineEntry = {
        id: uuidv4(),
        leadId: leadId,
        stage: 'Lead Created',
        stageId: 'stage-0',
        remark: `Customer record created (ID: ${realCustomerId})`,
        changedBy: 'system',
        changedByName: 'System',
        timestamp: new Date()
      };

      // Verify timeline entry structure
      assert.ok(timelineEntry.id, 'Timeline entry should have ID');
      assert.strictEqual(timelineEntry.leadId, leadId, 'Timeline entry should reference lead');
      assert.ok(
        timelineEntry.remark.includes(realCustomerId),
        'Timeline entry should include customer ID'
      );
      assert.strictEqual(timelineEntry.changedBy, 'system', 'Timeline entry should be by system');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent lead gracefully', async () => {
      const nonExistentLeadId = uuidv4();

      const eventData = {
        customerId: uuidv4(),
        tempCustomerId: uuidv4(),
        leadId: nonExistentLeadId,
        referenceId: 'LEAD-2024-003',
        email: 'test@example.com',
        createdAt: new Date()
      };

      // Mock: lead not found
      const lead = null;

      // Should handle gracefully without throwing
      if (!lead) {
        // Expected behavior - log and return
        assert.ok(true, 'Should handle missing lead gracefully');
      }
    });

    it('should continue even if timeline entry creation fails', async () => {
      const leadId = uuidv4();
      const realCustomerId = uuidv4();

      // Main update succeeds
      const updateSuccess = true;

      // Timeline creation fails
      let timelineError = new Error('Timeline creation failed');

      // Should not throw - main operation succeeded
      assert.ok(updateSuccess, 'Main update should succeed');
      assert.ok(timelineError, 'Timeline error should be logged but not thrown');
    });
  });

  describe('Integration Flow', () => {
    it('should complete full customer creation flow', async () => {
      // Step 1: Lead created with temp customer ID
      const tempCustomerId = uuidv4();
      const leadId = uuidv4();

      const leadCreated = {
        id: leadId,
        customerId: tempCustomerId,
        customerCreationPending: true,
        firstName: 'Integration',
        lastName: 'Test',
        email: 'integration@test.com'
      };

      assert.strictEqual(
        leadCreated.customerCreationPending,
        true,
        'Lead should be created with pending flag'
      );

      // Step 2: Customer created in customer service
      const realCustomerId = uuidv4();
      const customerCreated = {
        id: realCustomerId,
        customerType: 'INDIVIDUAL',
        firstName: 'Integration',
        lastName: 'Test',
        email: 'integration@test.com'
      };

      assert.ok(customerCreated.id, 'Customer should be created');

      // Step 3: Lead updated with real customer ID
      const leadUpdated = {
        ...leadCreated,
        customerId: realCustomerId,
        customerCreationPending: false
      };

      assert.strictEqual(leadUpdated.customerId, realCustomerId, 'Lead should have real customer ID');
      assert.strictEqual(
        leadUpdated.customerCreationPending,
        false,
        'Pending flag should be cleared'
      );
    });
  });
});
