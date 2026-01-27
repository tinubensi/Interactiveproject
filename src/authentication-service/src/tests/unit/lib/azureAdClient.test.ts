/**
 * Azure AD Client Tests - Multi-Tenant Support
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { validateTenant, buildLogoutUrl } from '../../../lib/azureAdClient';
import { resetConfig } from '../../../lib/config';

describe('azureAdClient - Multi-Tenant Support', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
    // Clear config singleton
    resetConfig();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetConfig();
  });

  describe('validateTenant', () => {
    it('should allow tenant when it is in allowedTenantIds list', () => {
      process.env.AZURE_AD_ALLOWED_TENANT_IDS = 'tenant-1,tenant-2,tenant-3';
      process.env.AZURE_AD_AUTHORITY = 'common';
      process.env.AZURE_AD_TENANT_ID = 'tenant-1';
      process.env.AZURE_AD_CLIENT_ID = 'test-client-id';
      process.env.AZURE_AD_CLIENT_SECRET = 'test-secret';

      const result = validateTenant('tenant-2');
      assert.strictEqual(result, true);
    });

    it('should reject tenant when it is not in allowedTenantIds list', () => {
      process.env.AZURE_AD_ALLOWED_TENANT_IDS = 'tenant-1,tenant-2';
      process.env.AZURE_AD_AUTHORITY = 'common';
      process.env.AZURE_AD_TENANT_ID = 'tenant-1';
      process.env.AZURE_AD_CLIENT_ID = 'test-client-id';
      process.env.AZURE_AD_CLIENT_SECRET = 'test-secret';

      const result = validateTenant('tenant-3');
      assert.strictEqual(result, false);
    });

    it('should allow any tenant when authority is "common" and no allowedTenantIds specified', () => {
      process.env.AZURE_AD_AUTHORITY = 'common';
      process.env.AZURE_AD_CLIENT_ID = 'test-client-id';
      process.env.AZURE_AD_CLIENT_SECRET = 'test-secret';
      // No AZURE_AD_ALLOWED_TENANT_IDS set

      const result = validateTenant('any-tenant-id');
      assert.strictEqual(result, true);
    });

    it('should allow any tenant when authority is "organizations" and no allowedTenantIds specified', () => {
      process.env.AZURE_AD_AUTHORITY = 'organizations';
      process.env.AZURE_AD_CLIENT_ID = 'test-client-id';
      process.env.AZURE_AD_CLIENT_SECRET = 'test-secret';
      // No AZURE_AD_ALLOWED_TENANT_IDS set

      const result = validateTenant('any-tenant-id');
      assert.strictEqual(result, true);
    });

    it('should fallback to single tenant validation when no authority and allowedTenantIds specified', () => {
      process.env.AZURE_AD_TENANT_ID = 'tenant-1';
      process.env.AZURE_AD_CLIENT_ID = 'test-client-id';
      process.env.AZURE_AD_CLIENT_SECRET = 'test-secret';
      // No AZURE_AD_AUTHORITY or AZURE_AD_ALLOWED_TENANT_IDS

      const result1 = validateTenant('tenant-1');
      assert.strictEqual(result1, true);

      const result2 = validateTenant('tenant-2');
      assert.strictEqual(result2, false);
    });

    it('should handle empty allowedTenantIds array', () => {
      process.env.AZURE_AD_ALLOWED_TENANT_IDS = '';
      process.env.AZURE_AD_AUTHORITY = 'common';
      process.env.AZURE_AD_CLIENT_ID = 'test-client-id';
      process.env.AZURE_AD_CLIENT_SECRET = 'test-secret';

      const result = validateTenant('any-tenant-id');
      assert.strictEqual(result, true);
    });

    it('should trim whitespace from tenant IDs in allowedTenantIds', () => {
      process.env.AZURE_AD_ALLOWED_TENANT_IDS = ' tenant-1 , tenant-2 , tenant-3 ';
      process.env.AZURE_AD_AUTHORITY = 'common';
      process.env.AZURE_AD_TENANT_ID = 'tenant-1';
      process.env.AZURE_AD_CLIENT_ID = 'test-client-id';
      process.env.AZURE_AD_CLIENT_SECRET = 'test-secret';

      const result1 = validateTenant('tenant-1');
      assert.strictEqual(result1, true);

      const result2 = validateTenant('tenant-2');
      assert.strictEqual(result2, true);

      const result3 = validateTenant('tenant-3');
      assert.strictEqual(result3, true);
    });
  });

  describe('buildLogoutUrl', () => {
    it('should use common endpoint when authority is "common"', () => {
      process.env.AZURE_AD_AUTHORITY = 'common';
      process.env.AZURE_AD_CLIENT_ID = 'test-client-id';
      process.env.AZURE_AD_CLIENT_SECRET = 'test-secret';

      const url = buildLogoutUrl();
      assert.ok(url.includes('login.microsoftonline.com/common/oauth2/v2.0/logout'));
    });

    it('should use organizations endpoint when authority is "organizations"', () => {
      process.env.AZURE_AD_AUTHORITY = 'organizations';
      process.env.AZURE_AD_CLIENT_ID = 'test-client-id';
      process.env.AZURE_AD_CLIENT_SECRET = 'test-secret';

      const url = buildLogoutUrl();
      assert.ok(url.includes('login.microsoftonline.com/organizations/oauth2/v2.0/logout'));
    });

    it('should use tenant-specific endpoint when tenantId is provided and no authority', () => {
      process.env.AZURE_AD_TENANT_ID = 'tenant-123';
      process.env.AZURE_AD_CLIENT_ID = 'test-client-id';
      process.env.AZURE_AD_CLIENT_SECRET = 'test-secret';

      const url = buildLogoutUrl();
      assert.ok(url.includes('login.microsoftonline.com/tenant-123/oauth2/v2.0/logout'));
    });

    it('should include post_logout_redirect_uri when provided', () => {
      process.env.AZURE_AD_AUTHORITY = 'common';
      process.env.AZURE_AD_CLIENT_ID = 'test-client-id';
      process.env.AZURE_AD_CLIENT_SECRET = 'test-secret';

      const redirectUri = 'https://example.com/logout';
      const url = buildLogoutUrl(redirectUri);
      
      assert.ok(url.includes('post_logout_redirect_uri'));
      assert.ok(url.includes(encodeURIComponent(redirectUri)));
    });

    it('should default to common endpoint when no authority or tenantId provided', () => {
      process.env.AZURE_AD_CLIENT_ID = 'test-client-id';
      process.env.AZURE_AD_CLIENT_SECRET = 'test-secret';
      // No AZURE_AD_AUTHORITY or AZURE_AD_TENANT_ID

      const url = buildLogoutUrl();
      assert.ok(url.includes('login.microsoftonline.com/common/oauth2/v2.0/logout'));
    });
  });
});
