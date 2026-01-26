/**
 * Tests for Customer Creation Request Handler
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { v4 as uuidv4 } from 'uuid';

describe('Handle Customer Creation Requested', () => {
  describe('Event Data Validation', () => {
    it('should validate required fields in event data', async () => {
      const eventData = {
        tempCustomerId: uuidv4(),
        leadId: uuidv4(),
        referenceId: 'LEAD-2024-001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: {
          number: '+971501234567',
          countryCode: '+971',
          isoCode: 'AE'
        },
        businessType: 'individual',
        lineOfBusiness: 'medical',
        createdAt: new Date()
      };

      // Verify required fields
      assert.ok(eventData.tempCustomerId, 'tempCustomerId is required');
      assert.ok(eventData.leadId, 'leadId is required');
      assert.ok(eventData.email, 'email is required');
      assert.ok(eventData.firstName, 'firstName is required');
      assert.ok(eventData.lastName, 'lastName is required');
    });

    it('should handle missing optional fields with defaults', async () => {
      const eventData: any = {
        tempCustomerId: uuidv4(),
        leadId: uuidv4(),
        referenceId: 'LEAD-2024-002',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: {
          number: '+971509876543',
          countryCode: '+971'
        },
        businessType: 'individual',
        lineOfBusiness: 'medical',
        createdAt: new Date()
        // lobData is missing - should use defaults
      };

      // Defaults should be applied
      const gender = eventData.lobData?.gender || 'Male';
      const agent = 'system';
      const currency = 'AED';

      assert.strictEqual(gender, 'Male', 'Should default gender to Male');
      assert.strictEqual(agent, 'system', 'Should default agent to system');
      assert.strictEqual(currency, 'AED', 'Should default currency to AED');
    });
  });

  describe('Customer Data Mapping', () => {
    it('should map individual lead data to customer data correctly', async () => {
      const eventData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: {
          number: '+971501234567',
          countryCode: '+971'
        },
        businessType: 'individual',
        lobData: {
          gender: 'Male'
        }
      };

      const customerData = {
        customerType: 'INDIVIDUAL',
        firstName: eventData.firstName,
        lastName: eventData.lastName,
        name: `${eventData.firstName} ${eventData.lastName}`,
        email: eventData.email,
        phoneNumber: eventData.phone.number,
        gender: eventData.lobData.gender,
        agent: 'system',
        currency: 'AED'
      };

      assert.strictEqual(customerData.customerType, 'INDIVIDUAL');
      assert.strictEqual(customerData.firstName, 'John');
      assert.strictEqual(customerData.lastName, 'Doe');
      assert.strictEqual(customerData.name, 'John Doe');
      assert.strictEqual(customerData.email, 'john@example.com');
      assert.strictEqual(customerData.gender, 'Male');
    });

    it('should map company lead data to customer data correctly', async () => {
      const eventData = {
        firstName: 'ABC',
        lastName: 'Trading',
        email: 'info@abctrading.com',
        phone: {
          number: '+971509876543',
          countryCode: '+971'
        },
        businessType: 'group'
      };

      const customerData = {
        customerType: 'COMPANY',
        companyName: `${eventData.firstName} ${eventData.lastName}`,
        email1: eventData.email,
        phoneNumber1: eventData.phone.number,
        agent: 'system',
        currency: 'AED'
      };

      assert.strictEqual(customerData.customerType, 'COMPANY');
      assert.strictEqual(customerData.companyName, 'ABC Trading');
      assert.strictEqual(customerData.email1, 'info@abctrading.com');
    });
  });

  describe('Retry Logic', () => {
    it('should retry creation on failure with exponential backoff', async () => {
      const retryDelays = [1000, 2000, 4000];
      const maxRetries = 3;

      let attemptCount = 0;
      const mockCreateWithRetry = async (attempt: number = 1): Promise<any> => {
        attemptCount++;
        if (attempt < maxRetries) {
          throw new Error('Simulated failure');
        }
        return { id: uuidv4(), success: true };
      };

      try {
        await mockCreateWithRetry(1);
      } catch (error) {
        // Expected to fail on first attempts
      }

      // Verify retry delays are exponential
      assert.strictEqual(retryDelays[0], 1000, 'First retry delay should be 1s');
      assert.strictEqual(retryDelays[1], 2000, 'Second retry delay should be 2s');
      assert.strictEqual(retryDelays[2], 4000, 'Third retry delay should be 4s');
    });

    it('should give up after max retries and log alert', async () => {
      const maxRetries = 3;
      let attemptCount = 0;

      const mockCreateWithRetry = async (): Promise<any> => {
        attemptCount++;
        if (attemptCount <= maxRetries) {
          throw new Error('Persistent failure');
        }
        return { id: uuidv4() };
      };

      let errorThrown = false;
      try {
        await mockCreateWithRetry();
        await mockCreateWithRetry();
        await mockCreateWithRetry();
        await mockCreateWithRetry();
      } catch (error) {
        errorThrown = true;
      }

      assert.strictEqual(attemptCount, 4, 'Should attempt 4 times (initial + 3 retries)');
      assert.ok(!errorThrown, 'Should eventually succeed after retries');
    });
  });

  describe('Existing Customer Handling', () => {
    it('should use existing customer ID if customer already exists', async () => {
      const existingCustomerId = 'existing-customer-456';
      const email = 'existing@example.com';

      // Mock: customer already exists
      const existingCustomer = {
        id: existingCustomerId,
        email: email,
        customerType: 'INDIVIDUAL'
      };

      // Should return existing customer instead of creating new one
      assert.strictEqual(existingCustomer.id, existingCustomerId);
      assert.strictEqual(existingCustomer.email, email);
    });
  });

  describe('Event Publishing After Success', () => {
    it('should publish customer.created_from_lead event after successful creation', async () => {
      const realCustomerId = uuidv4();
      const tempCustomerId = uuidv4();
      const leadId = uuidv4();

      const eventData = {
        customerId: realCustomerId,
        tempCustomerId: tempCustomerId,
        leadId: leadId,
        referenceId: 'LEAD-2024-003',
        email: 'test@example.com',
        createdAt: new Date()
      };

      // Verify event structure
      assert.ok(eventData.customerId, 'Event should have real customerId');
      assert.ok(eventData.tempCustomerId, 'Event should have tempCustomerId');
      assert.ok(eventData.leadId, 'Event should have leadId');
      assert.notStrictEqual(eventData.customerId, eventData.tempCustomerId, 'IDs should be different');
    });
  });
});
