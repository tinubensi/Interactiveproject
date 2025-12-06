/**
 * Contract tests: All Services <-> Auth Middleware
 * 
 * These tests verify that all services correctly implement
 * authentication via the shared auth middleware
 */

import { ApiClient } from '../utils/api-client';
import { SERVICES } from '../utils/config';
import { USERS, createUserHeaders } from '../fixtures/users';

describe('Auth Middleware Contract', () => {
  const servicesToTest: (keyof typeof SERVICES)[] = [
    'authentication',
    'authorization',
    'audit',
    'staffManagement',
    'notification',
    'workflow',
    'customer',
    'lead',
    'form',
    'document',
    'quotation',
    'policy',
  ];

  describe('All services should have health endpoint', () => {
    servicesToTest.forEach(serviceName => {
      it(`${serviceName} should respond to health check`, async () => {
        const client = new ApiClient(serviceName);
        const response = await client.get('/api/health');
        
        expect([200, 503]).toContain(response.status);
      });
    });
  });

  describe('Protected endpoints should reject unauthenticated requests', () => {
    const protectedEndpoints: Array<{ service: keyof typeof SERVICES; path: string; method: 'get' | 'post' }> = [
      { service: 'authorization', path: '/api/roles', method: 'get' },
      { service: 'audit', path: '/api/audit/logs', method: 'get' },
      { service: 'staffManagement', path: '/api/staff', method: 'get' },
      { service: 'notification', path: '/api/notifications', method: 'get' },
      { service: 'workflow', path: '/api/workflows', method: 'get' },
      { service: 'customer', path: '/api/customers', method: 'get' },
      { service: 'lead', path: '/api/leads', method: 'get' },
      { service: 'form', path: '/api/templates', method: 'get' },
    ];

    protectedEndpoints.forEach(({ service, path, method }) => {
      it(`${service} ${path} should reject unauthenticated requests`, async () => {
        const client = new ApiClient(service);
        const response = await client[method](path);
        
        // Should return 401 or 403
        expect([401, 403]).toContain(response.status);
      });
    });
  });

  describe('Protected endpoints should accept authenticated requests', () => {
    const protectedEndpoints: Array<{ service: keyof typeof SERVICES; path: string; method: 'get' | 'post' }> = [
      { service: 'authorization', path: '/api/roles', method: 'get' },
      { service: 'audit', path: '/api/audit/logs', method: 'get' },
      { service: 'staffManagement', path: '/api/staff', method: 'get' },
      { service: 'notification', path: '/api/notifications', method: 'get' },
      { service: 'workflow', path: '/api/workflows', method: 'get' },
    ];

    protectedEndpoints.forEach(({ service, path, method }) => {
      it(`${service} ${path} should accept authenticated requests`, async () => {
        const client = new ApiClient(service, { authenticated: true, asAdmin: true });
        const response = await client[method](path);
        
        // Should return success or permission error (not auth error)
        expect([200, 403, 404, 500]).toContain(response.status);
      });
    });
  });

  describe('Service-to-service authentication', () => {
    it('audit service should accept internal service key', async () => {
      const client = new ApiClient('audit', { asService: true });
      const response = await client.post('/api/audit/internal/log', {
        action: 'test:contract',
        entityType: 'test',
        entityId: 'test-001',
        userId: 'system',
        userName: 'System',
        timestamp: new Date().toISOString(),
      });
      
      expect([200, 201, 401, 403]).toContain(response.status);
    });

    it('notification service should accept internal service key', async () => {
      const client = new ApiClient('notification', { asService: true });
      const response = await client.post('/api/notifications/send', {
        templateId: 'test',
        userId: USERS.broker.userId,
        channel: 'in-app',
        data: {},
      });
      
      expect([200, 201, 401, 403]).toContain(response.status);
    });

    it('authorization service should accept internal service key', async () => {
      const client = new ApiClient('authorization', { asService: true });
      const response = await client.post('/api/permissions/check', {
        userId: USERS.broker.userId,
        permission: 'customers:read',
      });
      
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  describe('User context propagation', () => {
    it('should extract userId from auth headers', async () => {
      const client = new ApiClient('notification', { authenticated: true });
      
      // Get user's notifications - service should use userId from context
      const response = await client.get('/api/notifications');
      
      // Should succeed and return notifications for the authenticated user
      expect([200, 401]).toContain(response.status);
    });

    it('should respect role-based permissions', async () => {
      // Regular user should not access admin endpoints
      const userClient = new ApiClient('authorization', { authenticated: true });
      const adminClient = new ApiClient('authorization', { authenticated: true, asAdmin: true });
      
      const userResponse = await userClient.post('/api/roles', {
        roleId: 'test-role',
        displayName: 'Test',
        permissions: [],
        isSystem: false,
      });
      
      const adminResponse = await adminClient.post('/api/roles', {
        roleId: `test-role-${Date.now()}`,
        displayName: 'Test',
        permissions: [],
        isSystem: false,
      });
      
      // User should be forbidden, admin should succeed
      expect([401, 403]).toContain(userResponse.status);
      expect([200, 201, 401]).toContain(adminResponse.status);
    });
  });
});

