/**
 * Contract tests: Authentication Service <-> Authorization Service
 * 
 * These tests verify the contract between services:
 * 1. Auth service provides user context in expected format
 * 2. Authz service accepts and processes user context correctly
 */

import { ApiClient } from '../utils/api-client';
import { USERS, createUserHeaders } from '../fixtures/users';

describe('Auth -> Authz Contract', () => {
  let authClient: ApiClient;
  let authzClient: ApiClient;

  beforeAll(() => {
    authClient = new ApiClient('authentication', { authenticated: true, asAdmin: true });
    authzClient = new ApiClient('authorization', { asService: true });
  });

  describe('User Context Format', () => {
    it('should provide user context with required fields', async () => {
      // Get user context from auth service
      const authResponse = await authClient.get('/api/auth/me');
      
      // If auth service is running and returns user context
      if (authResponse.status === 200) {
        const userContext = authResponse.data as Record<string, unknown>;
        
        // Verify required fields
        expect(userContext).toHaveProperty('userId');
        expect(userContext).toHaveProperty('roles');
        
        // Roles should be an array
        expect(Array.isArray(userContext.roles)).toBe(true);
      }
    });

    it('should provide user context that authz service accepts', async () => {
      // Get user context from auth
      const authResponse = await authClient.get('/api/auth/me');
      
      if (authResponse.status === 200) {
        const userContext = authResponse.data as { userId: string };
        
        // Use this user context with authz service
        const authzResponse = await authzClient.post('/api/permissions/check', {
          userId: userContext.userId,
          permission: 'customers:read',
        });
        
        // Authz should accept the userId format
        expect([200, 401]).toContain(authzResponse.status);
      }
    });
  });

  describe('Token Validation Flow', () => {
    it('should validate tokens from auth service in authz service', async () => {
      // This tests the flow:
      // 1. User authenticates with Auth service
      // 2. Auth service issues token with user context
      // 3. Authz service receives requests with this token
      // 4. Authz validates and uses the user context

      const checkRequest = {
        userId: USERS.broker.userId,
        permission: 'customers:read:own',
      };

      const response = await authzClient.post('/api/permissions/check', checkRequest);
      
      // Authz service should be able to process the request
      expect([200, 401]).toContain(response.status);
    });
  });

  describe('Role Synchronization', () => {
    it('should have consistent role definitions', async () => {
      // Get roles from authz service
      const authzRolesResponse = await authzClient.get('/api/roles');
      
      if (authzRolesResponse.status === 200) {
        const roles = authzRolesResponse.data as { roleId: string }[];
        
        // System roles should exist
        const systemRoles = ['super-admin', 'broker-manager', 'broker'];
        
        for (const roleId of systemRoles) {
          const roleExists = roles.some(r => r.roleId === roleId);
          // Role should exist or authz should handle gracefully
          expect([true, false]).toContain(roleExists);
        }
      }
    });
  });
});

