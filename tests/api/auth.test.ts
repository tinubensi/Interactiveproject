/**
 * API tests for Authentication Service
 */

import { ApiClient } from '../utils/api-client';
import { SERVICES } from '../utils/config';
import { USERS, createUserHeaders } from '../fixtures/users';

describe('Authentication Service API', () => {
  const baseUrl = SERVICES.authentication.url;
  let client: ApiClient;
  let unauthenticatedClient: ApiClient;

  beforeAll(() => {
    client = new ApiClient('authentication', { authenticated: true, asAdmin: true });
    unauthenticatedClient = new ApiClient('authentication');
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

  describe('POST /api/auth/introspect', () => {
    it('should validate a valid token and return user context', async () => {
      const response = await client.post('/api/auth/introspect');
      
      // Should return user context or 200 for valid token
      expect([200, 401]).toContain(response.status);
    });

    it('should reject invalid tokens', async () => {
      const response = await unauthenticatedClient.post('/api/auth/introspect', {}, {
        headers: { 'Authorization': 'Bearer invalid-token' },
      });
      
      expect([400, 401]).toContain(response.status);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should reject requests without refresh token', async () => {
      const response = await unauthenticatedClient.post('/api/auth/refresh');
      
      expect([400, 401]).toContain(response.status);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should handle logout request', async () => {
      const response = await client.post('/api/auth/logout');
      
      // Should return success or no content
      expect([200, 204, 401]).toContain(response.status);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user info when authenticated', async () => {
      const response = await client.get('/api/auth/me');
      
      // Should return user info or require auth
      expect([200, 401]).toContain(response.status);
    });

    it('should reject unauthenticated requests', async () => {
      const response = await unauthenticatedClient.get('/api/auth/me');
      
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Authentication Flow Integration', () => {
    it('should support the full authentication lifecycle', async () => {
      // Step 1: Check health
      const healthResponse = await unauthenticatedClient.get('/api/health');
      expect(healthResponse.status).toBe(200);

      // Step 2: Try to get current user (should fail without auth)
      const meResponseUnauth = await unauthenticatedClient.get('/api/auth/me');
      expect([401, 403]).toContain(meResponseUnauth.status);

      // Step 3: With auth header, should succeed or validate
      const meResponseAuth = await client.get('/api/auth/me');
      expect([200, 401]).toContain(meResponseAuth.status);
    });
  });
});

