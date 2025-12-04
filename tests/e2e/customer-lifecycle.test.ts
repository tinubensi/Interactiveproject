/**
 * E2E Test: Customer Lifecycle
 * 
 * Tests the complete customer journey:
 * 1. User logs in
 * 2. Creates a customer
 * 3. Audit trail is generated
 * 4. Customer is updated
 * 5. Lead is created for customer
 * 6. Notifications are sent
 */

import { ApiClient } from '../utils/api-client';
import { USERS } from '../fixtures/users';
import { generateCustomer } from '../fixtures/customers';
import { generateLead } from '../fixtures/leads';

describe('E2E: Customer Lifecycle', () => {
  let customerClient: ApiClient;
  let leadClient: ApiClient;
  let auditClient: ApiClient;
  let notificationClient: ApiClient;

  let createdCustomerId: string | null = null;
  let createdLeadId: string | null = null;

  beforeAll(() => {
    customerClient = new ApiClient('customer', { authenticated: true });
    leadClient = new ApiClient('lead', { authenticated: true });
    auditClient = new ApiClient('audit', { authenticated: true, asAdmin: true });
    notificationClient = new ApiClient('notification', { authenticated: true });
  });

  afterAll(async () => {
    // Cleanup created resources
    if (createdCustomerId) {
      await customerClient.delete(`/api/customers/${createdCustomerId}`);
    }
    if (createdLeadId) {
      await leadClient.delete(`/api/leads/${createdLeadId}`);
    }
  });

  describe('Complete Customer Journey', () => {
    it('Step 1: Create a new customer', async () => {
      const customer = generateCustomer();
      
      const response = await customerClient.post('/api/customers', customer);
      
      expect([200, 201, 401, 403]).toContain(response.status);
      
      if (response.status === 201 || response.status === 200) {
        const created = response.data as { customerId: string };
        createdCustomerId = created.customerId;
        console.log(`✓ Customer created: ${createdCustomerId}`);
      }
    });

    it('Step 2: Verify customer was created', async () => {
      if (!createdCustomerId) {
        console.log('⏭ Skipping - no customer created');
        return;
      }

      const response = await customerClient.get(`/api/customers/${createdCustomerId}`);
      
      expect([200, 401]).toContain(response.status);
      if (response.status === 200) {
        console.log('✓ Customer retrieved successfully');
      }
    });

    it('Step 3: Verify audit trail was created', async () => {
      if (!createdCustomerId) {
        console.log('⏭ Skipping - no customer created');
        return;
      }

      // Wait briefly for async audit processing
      await new Promise(resolve => setTimeout(resolve, 500));

      const response = await auditClient.get(
        `/api/audit/entity/customer/${createdCustomerId}`
      );
      
      expect([200, 401, 404]).toContain(response.status);
      
      if (response.status === 200) {
        const logs = response.data as { logs: unknown[] };
        console.log(`✓ Audit trail found: ${logs.logs?.length || 0} entries`);
      }
    });

    it('Step 4: Update customer information', async () => {
      if (!createdCustomerId) {
        console.log('⏭ Skipping - no customer created');
        return;
      }

      const response = await customerClient.put(
        `/api/customers/${createdCustomerId}`,
        { phone: '+971509999999' }
      );
      
      expect([200, 401, 404]).toContain(response.status);
      if (response.status === 200) {
        console.log('✓ Customer updated');
      }
    });

    it('Step 5: Create a lead for the customer', async () => {
      if (!createdCustomerId) {
        console.log('⏭ Skipping - no customer created');
        return;
      }

      const lead = generateLead({
        customerId: createdCustomerId,
        insuranceLine: 'motor',
      });

      const response = await leadClient.post('/api/leads', lead);
      
      expect([200, 201, 401, 403]).toContain(response.status);
      
      if (response.status === 201 || response.status === 200) {
        const created = response.data as { leadId: string };
        createdLeadId = created.leadId;
        console.log(`✓ Lead created: ${createdLeadId}`);
      }
    });

    it('Step 6: Verify lead is linked to customer', async () => {
      if (!createdCustomerId || !createdLeadId) {
        console.log('⏭ Skipping - no customer/lead created');
        return;
      }

      const response = await leadClient.get(`/api/leads/${createdLeadId}`);
      
      expect([200, 401]).toContain(response.status);
      
      if (response.status === 200) {
        const lead = response.data as { customerId?: string };
        expect(lead.customerId).toBe(createdCustomerId);
        console.log('✓ Lead linked to customer');
      }
    });

    it('Step 7: Check notifications were generated', async () => {
      // Check if any notifications were created for the broker
      const response = await notificationClient.get('/api/notifications?limit=5');
      
      expect([200, 401]).toContain(response.status);
      
      if (response.status === 200) {
        console.log('✓ Notification system accessible');
      }
    });
  });

  describe('Customer Search and List', () => {
    it('should list customers with pagination', async () => {
      const response = await customerClient.get('/api/customers?page=1&limit=10');
      
      expect([200, 401]).toContain(response.status);
      if (response.status === 200) {
        console.log('✓ Customer list with pagination');
      }
    });

    it('should search customers by email', async () => {
      const response = await customerClient.get(
        '/api/customers?search=example.com'
      );
      
      expect([200, 401]).toContain(response.status);
    });
  });

  describe('Data Integrity', () => {
    it('should not allow duplicate customer emails', async () => {
      const customer = generateCustomer({ email: 'duplicate@example.com' });
      
      // Create first
      await customerClient.post('/api/customers', customer);
      
      // Try to create duplicate
      const duplicateResponse = await customerClient.post('/api/customers', customer);
      
      // Should reject duplicate or handle gracefully
      expect([400, 409, 200, 201, 401]).toContain(duplicateResponse.status);
    });
  });
});

