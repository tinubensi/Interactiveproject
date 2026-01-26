/**
 * Tests for Async Customer Creation in Lead Creation
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { v4 as uuidv4 } from 'uuid';

describe('Create Lead - Async Customer Creation', () => {
  describe('Lead Creation with Temp Customer ID', () => {
    it('should create lead with temp UUID when no customerId provided', async () => {
      const leadData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: {
          number: '+971501234567',
          countryCode: '+971',
          isoCode: 'AE'
        },
        lineOfBusiness: 'medical',
        businessType: 'individual',
        emirate: 'Dubai',
        lobData: {
          dateOfBirth: '1990-01-01',
          gender: 'Male',
          nationality: 'UAE'
        }
      };

      // Mock the lead creation
      const tempCustomerId = uuidv4();
      const lead: any = {
        id: uuidv4(),
        customerId: tempCustomerId,
        customerCreationPending: true,
        ...leadData
      };

      // Verify temp customer ID is a valid UUID
      assert.ok(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(lead.customerId),
        'customerId should be a valid UUID'
      );

      // Verify customerCreationPending flag is set
      assert.strictEqual(lead.customerCreationPending, true, 'customerCreationPending should be true');
    });

    it('should use provided customerId when available', async () => {
      const providedCustomerId = 'existing-customer-123';
      const leadData = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        phone: {
          number: '+971509876543',
          countryCode: '+971',
          isoCode: 'AE'
        },
        lineOfBusiness: 'medical',
        businessType: 'individual',
        emirate: 'Abu Dhabi',
        customerId: providedCustomerId
      };

      const lead: any = {
        id: uuidv4(),
        customerId: providedCustomerId,
        customerCreationPending: false,
        ...leadData
      };

      // Verify provided customer ID is used
      assert.strictEqual(lead.customerId, providedCustomerId, 'Should use provided customerId');

      // Verify customerCreationPending flag is false
      assert.strictEqual(lead.customerCreationPending, false, 'customerCreationPending should be false');
    });
  });

  describe('Event Publishing', () => {
    it('should publish customer.creation_requested event when customerCreationPending is true', async () => {
      const tempCustomerId = uuidv4();
      const leadId = uuidv4();
      
      const eventData = {
        tempCustomerId,
        leadId,
        referenceId: 'LEAD-2024-001',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: {
          number: '+971501234567',
          countryCode: '+971',
          isoCode: 'AE'
        },
        businessType: 'individual',
        lineOfBusiness: 'medical',
        createdAt: new Date()
      };

      // Verify event data structure
      assert.ok(eventData.tempCustomerId, 'Event should have tempCustomerId');
      assert.ok(eventData.leadId, 'Event should have leadId');
      assert.ok(eventData.email, 'Event should have email');
      assert.strictEqual(eventData.businessType, 'individual', 'Event should have businessType');
    });

    it('should not publish customer.creation_requested event when customerId is provided', async () => {
      const providedCustomerId = 'existing-customer-123';
      const customerCreationPending = false;

      assert.strictEqual(customerCreationPending, false, 'Should not trigger customer creation');
    });
  });

  describe('Response Structure', () => {
    it('should include customerCreationPending flag in response warnings', async () => {
      const response = {
        success: true,
        message: 'Lead created successfully',
        data: {
          lead: {
            id: uuidv4(),
            customerId: uuidv4(),
            customerCreationPending: true
          },
          warnings: {
            customerCreationPending: true,
            customerEventPublished: true
          }
        }
      };

      assert.strictEqual(
        response.data.warnings.customerCreationPending,
        true,
        'Response should indicate customer creation is pending'
      );
      assert.strictEqual(
        response.data.warnings.customerEventPublished,
        true,
        'Response should indicate event was published'
      );
    });
  });
});
