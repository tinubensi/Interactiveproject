/**
 * Permission Resolver Tests
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  matchesPermission,
  hasPermission,
  isWildcardPermission,
  hasScope,
  getScope,
  getBasePermission,
  hasAnyPermission,
  hasAllPermissions,
} from '../../../lib/permissionResolver';

describe('permissionResolver', () => {
  describe('matchesPermission', () => {
    it('should match exact permissions', () => {
      const result = matchesPermission('customers:read', 'customers:read');
      assert.strictEqual(result.matches, true);
      assert.strictEqual(result.scope, undefined);
    });

    it('should match wildcard permission (*:*)', () => {
      const result = matchesPermission('customers:read', '*:*');
      assert.strictEqual(result.matches, true);
      assert.strictEqual(result.scope, undefined);
    });

    it('should match category wildcard (customers:*)', () => {
      const result = matchesPermission('customers:read', 'customers:*');
      assert.strictEqual(result.matches, true);
    });

    it('should return scope for scoped permission', () => {
      const result = matchesPermission('customers:read', 'customers:read:own');
      assert.strictEqual(result.matches, true);
      assert.strictEqual(result.scope, 'own');
    });

    it('should return scope for category wildcard with scope', () => {
      const result = matchesPermission('customers:read', 'customers:*:team');
      assert.strictEqual(result.matches, true);
      assert.strictEqual(result.scope, 'team');
    });

    it('should not match different resources', () => {
      const result = matchesPermission('customers:read', 'leads:read');
      assert.strictEqual(result.matches, false);
    });

    it('should not match different actions', () => {
      const result = matchesPermission('customers:read', 'customers:delete');
      assert.strictEqual(result.matches, false);
    });

    it('should not match more restrictive permission', () => {
      // users:read does NOT grant users:read:own (the other direction is true)
      const result = matchesPermission('customers:read:own', 'customers:read');
      assert.strictEqual(result.matches, false);
    });
  });

  describe('hasPermission', () => {
    it('should find permission in user permissions', () => {
      const userPermissions = ['customers:read', 'leads:create'];
      const result = hasPermission(userPermissions, 'customers:read');
      
      assert.strictEqual(result.authorized, true);
      assert.strictEqual(result.matchedPermission, 'customers:read');
    });

    it('should find permission via wildcard', () => {
      const userPermissions = ['*:*'];
      const result = hasPermission(userPermissions, 'customers:delete');
      
      assert.strictEqual(result.authorized, true);
      assert.strictEqual(result.matchedPermission, '*:*');
    });

    it('should find permission via category wildcard', () => {
      const userPermissions = ['customers:*', 'leads:read'];
      const result = hasPermission(userPermissions, 'customers:delete');
      
      assert.strictEqual(result.authorized, true);
      assert.strictEqual(result.matchedPermission, 'customers:*');
    });

    it('should return scope when matched via scoped permission', () => {
      const userPermissions = ['customers:read:own', 'leads:read'];
      const result = hasPermission(userPermissions, 'customers:read');
      
      assert.strictEqual(result.authorized, true);
      assert.strictEqual(result.matchedPermission, 'customers:read:own');
      assert.strictEqual(result.scope, 'own');
    });

    it('should return unauthorized for missing permission', () => {
      const userPermissions = ['customers:read', 'leads:create'];
      const result = hasPermission(userPermissions, 'audit:read');
      
      assert.strictEqual(result.authorized, false);
      assert.strictEqual(result.matchedPermission, undefined);
    });

    it('should return unauthorized for empty permissions', () => {
      const result = hasPermission([], 'customers:read');
      assert.strictEqual(result.authorized, false);
    });
  });

  describe('isWildcardPermission', () => {
    it('should identify super wildcard', () => {
      assert.strictEqual(isWildcardPermission('*:*'), true);
    });

    it('should identify category wildcard', () => {
      assert.strictEqual(isWildcardPermission('customers:*'), true);
    });

    it('should not identify regular permission as wildcard', () => {
      assert.strictEqual(isWildcardPermission('customers:read'), false);
    });

    it('should not identify scoped permission as wildcard', () => {
      assert.strictEqual(isWildcardPermission('customers:read:own'), false);
    });
  });

  describe('hasScope', () => {
    it('should detect scope in permission', () => {
      assert.strictEqual(hasScope('customers:read:own'), true);
      assert.strictEqual(hasScope('customers:*:team'), true);
    });

    it('should return false for permission without scope', () => {
      assert.strictEqual(hasScope('customers:read'), false);
      assert.strictEqual(hasScope('*:*'), false);
    });
  });

  describe('getScope', () => {
    it('should extract scope from permission', () => {
      assert.strictEqual(getScope('customers:read:own'), 'own');
      assert.strictEqual(getScope('customers:*:team'), 'team');
      assert.strictEqual(getScope('staff:read:territory'), 'territory');
    });

    it('should return undefined for permission without scope', () => {
      assert.strictEqual(getScope('customers:read'), undefined);
      assert.strictEqual(getScope('*:*'), undefined);
    });
  });

  describe('getBasePermission', () => {
    it('should extract base permission without scope', () => {
      assert.strictEqual(getBasePermission('customers:read:own'), 'customers:read');
      assert.strictEqual(getBasePermission('staff:update:team'), 'staff:update');
    });

    it('should return same for permission without scope', () => {
      assert.strictEqual(getBasePermission('customers:read'), 'customers:read');
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if user has any of the required permissions', () => {
      const userPermissions = ['customers:read', 'leads:create'];
      const required = ['audit:read', 'customers:read', 'staff:manage'];
      
      const result = hasAnyPermission(userPermissions, required);
      assert.strictEqual(result.authorized, true);
      assert.strictEqual(result.matchedPermission, 'customers:read');
    });

    it('should return false if user has none of the required permissions', () => {
      const userPermissions = ['customers:read', 'leads:create'];
      const required = ['audit:read', 'staff:manage'];
      
      const result = hasAnyPermission(userPermissions, required);
      assert.strictEqual(result.authorized, false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true if user has all required permissions', () => {
      const userPermissions = ['customers:read', 'leads:create', 'quotes:read'];
      const required = ['customers:read', 'leads:create'];
      
      const result = hasAllPermissions(userPermissions, required);
      assert.strictEqual(result.authorized, true);
      assert.deepStrictEqual(result.missingPermissions, []);
    });

    it('should return false with missing permissions list', () => {
      const userPermissions = ['customers:read'];
      const required = ['customers:read', 'leads:create', 'audit:read'];
      
      const result = hasAllPermissions(userPermissions, required);
      assert.strictEqual(result.authorized, false);
      assert.deepStrictEqual(result.missingPermissions, ['leads:create', 'audit:read']);
    });
  });
});

