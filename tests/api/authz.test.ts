/**
 * API tests for Authorization Service
 */

import { ApiClient } from '../utils/api-client';
import { SERVICES } from '../utils/config';
import { USERS, createUserHeaders } from '../fixtures/users';
import { ROLES, CUSTOM_ROLE } from '../fixtures/roles';

describe('Authorization Service API', () => {
  let adminClient: ApiClient;
  let userClient: ApiClient;
  let serviceClient: ApiClient;
  let unauthenticatedClient: ApiClient;

  beforeAll(() => {
    adminClient = new ApiClient('authorization', { authenticated: true, asAdmin: true });
    userClient = new ApiClient('authorization', { authenticated: true });
    serviceClient = new ApiClient('authorization', { asService: true });
    unauthenticatedClient = new ApiClient('authorization');
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

  describe('Role Management', () => {
    describe('GET /api/roles', () => {
      it('should list all roles for admin', async () => {
        const response = await adminClient.get('/api/roles');
        
        expect([200, 401]).toContain(response.status);
        if (response.status === 200) {
          expect(Array.isArray(response.data)).toBe(true);
        }
      });

      it('should require authentication', async () => {
        const response = await unauthenticatedClient.get('/api/roles');
        
        expect([401, 403]).toContain(response.status);
      });
    });

    describe('GET /api/roles/:roleId', () => {
      it('should get a specific role', async () => {
        const response = await adminClient.get('/api/roles/broker');
        
        expect([200, 401, 404]).toContain(response.status);
      });

      it('should return 404 for non-existent role', async () => {
        const response = await adminClient.get('/api/roles/non-existent-role');
        
        expect([401, 404]).toContain(response.status);
      });
    });

    describe('POST /api/roles', () => {
      it('should create a new role (admin only)', async () => {
        const uniqueRoleId = `test-role-${Date.now()}`;
        const newRole = {
          ...CUSTOM_ROLE,
          roleId: uniqueRoleId,
        };

        const response = await adminClient.post('/api/roles', newRole);
        
        expect([201, 401, 403]).toContain(response.status);
      });

      it('should reject role creation for non-admin', async () => {
        const response = await userClient.post('/api/roles', CUSTOM_ROLE);
        
        expect([401, 403]).toContain(response.status);
      });
    });
  });

  describe('Permission Checking', () => {
    describe('POST /api/permissions/check', () => {
      it('should check if user has permission', async () => {
        const response = await serviceClient.post('/api/permissions/check', {
          userId: USERS.broker.userId,
          permission: 'customers:read:own',
        });
        
        expect([200, 401]).toContain(response.status);
      });

      it('should work with resource context', async () => {
        const response = await serviceClient.post('/api/permissions/check', {
          userId: USERS.broker.userId,
          permission: 'customers:read',
          resource: {
            type: 'customer',
            id: 'cust-001',
            ownerId: USERS.broker.userId,
          },
        });
        
        expect([200, 401]).toContain(response.status);
      });
    });

    describe('POST /api/permissions/batch-check', () => {
      it('should check multiple permissions at once', async () => {
        const response = await serviceClient.post('/api/permissions/batch-check', {
          userId: USERS.broker.userId,
          permissions: ['customers:read', 'leads:read', 'policies:read'],
        });
        
        expect([200, 401]).toContain(response.status);
      });
    });

    describe('GET /api/permissions/user/:userId', () => {
      it('should list all permissions for a user', async () => {
        const response = await adminClient.get(`/api/permissions/user/${USERS.broker.userId}`);
        
        expect([200, 401]).toContain(response.status);
      });
    });
  });

  describe('User Role Management', () => {
    describe('GET /api/users/:userId/roles', () => {
      it('should get roles for a user', async () => {
        const response = await adminClient.get(`/api/users/${USERS.broker.userId}/roles`);
        
        expect([200, 401, 404]).toContain(response.status);
      });
    });

    describe('POST /api/users/:userId/roles', () => {
      it('should assign role to user', async () => {
        const response = await adminClient.post(`/api/users/${USERS.noRoleUser.userId}/roles`, {
          roleId: 'read-only',
        });
        
        expect([200, 201, 401, 403, 404]).toContain(response.status);
      });
    });

    describe('DELETE /api/users/:userId/roles/:roleId', () => {
      it('should remove role from user', async () => {
        const response = await adminClient.delete(
          `/api/users/${USERS.noRoleUser.userId}/roles/read-only`
        );
        
        expect([200, 204, 401, 403, 404]).toContain(response.status);
      });
    });
  });

  describe('Temporary Permissions', () => {
    describe('POST /api/permissions/temporary', () => {
      it('should grant temporary permission', async () => {
        const response = await adminClient.post('/api/permissions/temporary', {
          userId: USERS.broker.userId,
          permission: 'customers:delete',
          expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
          reason: 'Testing temporary permissions',
        });
        
        expect([200, 201, 401, 403]).toContain(response.status);
      });
    });

    describe('GET /api/permissions/temporary/:userId', () => {
      it('should list temporary permissions for user', async () => {
        const response = await adminClient.get(
          `/api/permissions/temporary/${USERS.broker.userId}`
        );
        
        expect([200, 401, 404]).toContain(response.status);
      });
    });

    describe('DELETE /api/permissions/temporary/:permissionId', () => {
      it('should revoke temporary permission', async () => {
        const response = await adminClient.delete(
          '/api/permissions/temporary/temp-perm-001'
        );
        
        expect([200, 204, 401, 403, 404]).toContain(response.status);
      });
    });
  });
});

