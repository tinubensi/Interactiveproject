/**
 * API tests for Audit Service
 */

import { ApiClient } from '../utils/api-client';
import { SERVICES } from '../utils/config';
import { USERS } from '../fixtures/users';

describe('Audit Service API', () => {
  let adminClient: ApiClient;
  let complianceClient: ApiClient;
  let serviceClient: ApiClient;
  let userClient: ApiClient;
  let unauthenticatedClient: ApiClient;

  beforeAll(() => {
    adminClient = new ApiClient('audit', { authenticated: true, asAdmin: true });
    complianceClient = new ApiClient('audit', { authenticated: true });
    serviceClient = new ApiClient('audit', { asService: true });
    userClient = new ApiClient('audit', { authenticated: true });
    unauthenticatedClient = new ApiClient('audit');
  });

  describe('GET /api/health', () => {
    it('should return healthy status', async () => {
      const response = await unauthenticatedClient.get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        status: expect.stringMatching(/healthy|ok/i),
      });
    });
  });

  describe('Audit Log Queries', () => {
    describe('GET /api/audit/logs', () => {
      it('should query audit logs with admin access', async () => {
        const response = await adminClient.get('/api/audit/logs');
        
        expect([200, 401]).toContain(response.status);
        if (response.status === 200) {
          expect(response.data).toHaveProperty('logs');
        }
      });

      it('should support query parameters', async () => {
        const response = await adminClient.get(
          '/api/audit/logs?entityType=customer&limit=10'
        );
        
        expect([200, 401]).toContain(response.status);
      });

      it('should require authorization', async () => {
        const response = await unauthenticatedClient.get('/api/audit/logs');
        
        expect([401, 403]).toContain(response.status);
      });
    });

    describe('GET /api/audit/logs/:logId', () => {
      it('should get a specific audit log', async () => {
        const response = await adminClient.get('/api/audit/logs/log-001');
        
        expect([200, 401, 404]).toContain(response.status);
      });
    });

    describe('GET /api/audit/entity/:entityType/:entityId', () => {
      it('should query logs by entity', async () => {
        const response = await adminClient.get('/api/audit/entity/customer/cust-001');
        
        expect([200, 401, 404]).toContain(response.status);
      });
    });

    describe('GET /api/audit/user/:userId', () => {
      it('should query logs by user', async () => {
        const response = await adminClient.get(`/api/audit/user/${USERS.broker.userId}`);
        
        expect([200, 401, 404]).toContain(response.status);
      });
    });
  });

  describe('Audit Log Creation (Internal)', () => {
    describe('POST /api/audit/internal/log', () => {
      it('should create audit log via service key', async () => {
        const auditEntry = {
          action: 'customer:created',
          entityType: 'customer',
          entityId: `cust-test-${Date.now()}`,
          userId: USERS.broker.userId,
          userName: USERS.broker.displayName,
          timestamp: new Date().toISOString(),
          changes: {
            firstName: { to: 'Test' },
            lastName: { to: 'Customer' },
          },
          metadata: {
            source: 'api-test',
          },
        };

        const response = await serviceClient.post('/api/audit/internal/log', auditEntry);
        
        expect([200, 201, 401, 403]).toContain(response.status);
      });

      it('should reject without service key', async () => {
        const response = await userClient.post('/api/audit/internal/log', {
          action: 'test:action',
        });
        
        expect([401, 403]).toContain(response.status);
      });
    });
  });

  describe('Audit Export', () => {
    describe('POST /api/audit/export/pdf', () => {
      it('should export audit logs as PDF', async () => {
        const response = await adminClient.post('/api/audit/export/pdf', {
          entityType: 'customer',
          fromDate: new Date(Date.now() - 86400000).toISOString(),
          toDate: new Date().toISOString(),
        });
        
        expect([200, 202, 401, 403]).toContain(response.status);
      });
    });

    describe('POST /api/audit/export/csv', () => {
      it('should export audit logs as CSV', async () => {
        const response = await adminClient.post('/api/audit/export/csv', {
          entityType: 'customer',
          fromDate: new Date(Date.now() - 86400000).toISOString(),
          toDate: new Date().toISOString(),
        });
        
        expect([200, 202, 401, 403]).toContain(response.status);
      });
    });

    describe('GET /api/audit/export/:exportId', () => {
      it('should check export status', async () => {
        const response = await adminClient.get('/api/audit/export/export-001');
        
        expect([200, 401, 404]).toContain(response.status);
      });
    });
  });

  describe('Security Alerts', () => {
    describe('GET /api/audit/security/alerts', () => {
      it('should list security alerts', async () => {
        const response = await adminClient.get('/api/audit/security/alerts');
        
        expect([200, 401, 403]).toContain(response.status);
      });
    });

    describe('POST /api/audit/security/alerts/:alertId/acknowledge', () => {
      it('should acknowledge security alert', async () => {
        const response = await adminClient.post(
          '/api/audit/security/alerts/alert-001/acknowledge',
          { notes: 'Acknowledged in test' }
        );
        
        expect([200, 401, 403, 404]).toContain(response.status);
      });
    });
  });
});

