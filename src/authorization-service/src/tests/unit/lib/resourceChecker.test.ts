/**
 * Resource Checker Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  checkResourceScope,
  checkResourceWithScopes,
  hasFullAccess,
  getMatchingScopes,
  getBroadestScope,
  SCOPE_HIERARCHY,
  UserScopeContext,
} from '../../../lib/resourceChecker';
import { ResourceContext } from '../../../models/PermissionCache';

describe('resourceChecker', () => {
  // Test data
  const user: UserScopeContext = {
    userId: 'user-123',
    teamId: 'team-A',
    territory: ['Dubai', 'Abu Dhabi'],
  };

  describe('checkResourceScope', () => {
    it('should grant full access when no scope', () => {
      const resource: ResourceContext = { type: 'customer', id: 'cust-1' };
      const result = checkResourceScope(undefined, user, resource);
      
      assert.strictEqual(result.authorized, true);
      assert.strictEqual(result.reason, 'full_access');
    });

    it('should check :own scope against resource owner', () => {
      const ownResource: ResourceContext = { 
        type: 'customer', 
        id: 'cust-1',
        ownerId: 'user-123'  // Same as user
      };
      const result = checkResourceScope('own', user, ownResource);
      
      assert.strictEqual(result.authorized, true);
      assert.strictEqual(result.reason, 'owner_match');
    });

    it('should deny :own scope when not owner', () => {
      const otherResource: ResourceContext = { 
        type: 'customer', 
        id: 'cust-1',
        ownerId: 'other-user'
      };
      const result = checkResourceScope('own', user, otherResource);
      
      assert.strictEqual(result.authorized, false);
      assert.strictEqual(result.reason, 'not_owner');
    });

    it('should check :team scope against team membership', () => {
      const teamResource: ResourceContext = { 
        type: 'customer', 
        id: 'cust-1',
        teamId: 'team-A'  // Same as user
      };
      const result = checkResourceScope('team', user, teamResource);
      
      assert.strictEqual(result.authorized, true);
      assert.strictEqual(result.reason, 'team_match');
    });

    it('should deny :team scope when not in team', () => {
      const otherTeamResource: ResourceContext = { 
        type: 'customer', 
        id: 'cust-1',
        teamId: 'team-B'
      };
      const result = checkResourceScope('team', user, otherTeamResource);
      
      assert.strictEqual(result.authorized, false);
      assert.strictEqual(result.reason, 'not_in_team');
    });

    it('should check :territory scope against user territories', () => {
      const territoryResource: ResourceContext = { 
        type: 'customer', 
        id: 'cust-1',
        territory: 'Dubai'  // In user's territories
      };
      const result = checkResourceScope('territory', user, territoryResource);
      
      assert.strictEqual(result.authorized, true);
      assert.strictEqual(result.reason, 'territory_match');
    });

    it('should deny :territory scope when not in territory', () => {
      const otherTerritoryResource: ResourceContext = { 
        type: 'customer', 
        id: 'cust-1',
        territory: 'Sharjah'
      };
      const result = checkResourceScope('territory', user, otherTerritoryResource);
      
      assert.strictEqual(result.authorized, false);
      assert.strictEqual(result.reason, 'not_in_territory');
    });

    it('should check :self scope for customer self-service', () => {
      const selfUser: UserScopeContext = { userId: 'customer-123' };
      const selfResource: ResourceContext = { 
        type: 'customer', 
        id: 'customer-123'  // Same as user ID
      };
      const result = checkResourceScope('self', selfUser, selfResource);
      
      assert.strictEqual(result.authorized, true);
      assert.strictEqual(result.reason, 'self_match');
    });

    it('should deny :self scope for different user', () => {
      const selfResource: ResourceContext = { 
        type: 'customer', 
        id: 'other-customer'
      };
      const result = checkResourceScope('self', user, selfResource);
      
      assert.strictEqual(result.authorized, false);
      assert.strictEqual(result.reason, 'not_self');
    });
  });

  describe('checkResourceWithScopes', () => {
    it('should find first matching scope', () => {
      const resource: ResourceContext = { 
        type: 'customer', 
        id: 'cust-1',
        ownerId: 'other-user',
        teamId: 'team-A'  // User is in this team
      };
      
      const result = checkResourceWithScopes(['own', 'team'], user, resource);
      
      assert.strictEqual(result.authorized, true);
      assert.strictEqual(result.matchedScope, 'team');
      assert.strictEqual(result.reason, 'team_match');
    });

    it('should prefer broader scope when multiple match', () => {
      const resource: ResourceContext = { 
        type: 'customer', 
        id: 'cust-1',
        ownerId: 'user-123',  // User owns it
        territory: 'Dubai'   // And in user's territory
      };
      
      // territory (level 3) should be preferred over own (level 1)
      const result = checkResourceWithScopes(['own', 'territory'], user, resource);
      
      assert.strictEqual(result.authorized, true);
      assert.strictEqual(result.matchedScope, 'territory');
    });

    it('should return unauthorized when no scope matches', () => {
      const resource: ResourceContext = { 
        type: 'customer', 
        id: 'cust-1',
        ownerId: 'other-user',
        teamId: 'other-team'
      };
      
      const result = checkResourceWithScopes(['own', 'team'], user, resource);
      
      assert.strictEqual(result.authorized, false);
      assert.strictEqual(result.reason, 'no_matching_scope');
    });

    it('should grant access when undefined scope (full access) is included', () => {
      const resource: ResourceContext = { 
        type: 'customer', 
        id: 'cust-1',
        ownerId: 'other-user'
      };
      
      const result = checkResourceWithScopes([undefined, 'own'], user, resource);
      
      assert.strictEqual(result.authorized, true);
      assert.strictEqual(result.matchedScope, undefined);
      assert.strictEqual(result.reason, 'full_access');
    });
  });

  describe('hasFullAccess', () => {
    it('should return true for super admin (*:*)', () => {
      const permissions = ['*:*'];
      assert.strictEqual(hasFullAccess(permissions, 'customers:read'), true);
    });

    it('should return true for unscoped matching permission', () => {
      const permissions = ['customers:read', 'leads:create'];
      assert.strictEqual(hasFullAccess(permissions, 'customers:read'), true);
    });

    it('should return true for unscoped category wildcard', () => {
      const permissions = ['customers:*'];
      assert.strictEqual(hasFullAccess(permissions, 'customers:delete'), true);
    });

    it('should return false for scoped permission', () => {
      const permissions = ['customers:read:own'];
      assert.strictEqual(hasFullAccess(permissions, 'customers:read'), false);
    });

    it('should return false for scoped category wildcard', () => {
      const permissions = ['customers:*:team'];
      assert.strictEqual(hasFullAccess(permissions, 'customers:read'), false);
    });

    it('should return false for missing permission', () => {
      const permissions = ['leads:read'];
      assert.strictEqual(hasFullAccess(permissions, 'customers:read'), false);
    });
  });

  describe('getMatchingScopes', () => {
    it('should return undefined for super admin', () => {
      const permissions = ['*:*'];
      const scopes = getMatchingScopes(permissions, 'customers:read');
      assert.deepStrictEqual(scopes, [undefined]);
    });

    it('should return scopes from matching permissions', () => {
      const permissions = ['customers:read:own', 'customers:read:team'];
      const scopes = getMatchingScopes(permissions, 'customers:read');
      assert.deepStrictEqual(scopes, ['own', 'team']);
    });

    it('should return scope from category wildcard', () => {
      const permissions = ['customers:*:territory'];
      const scopes = getMatchingScopes(permissions, 'customers:read');
      assert.deepStrictEqual(scopes, ['territory']);
    });

    it('should return empty for non-matching permissions', () => {
      const permissions = ['leads:read:own'];
      const scopes = getMatchingScopes(permissions, 'customers:read');
      assert.deepStrictEqual(scopes, []);
    });
  });

  describe('getBroadestScope', () => {
    it('should return no scope (full access) as broadest', () => {
      const permissions = ['customers:read', 'customers:read:own'];
      const result = getBroadestScope(permissions, 'customers:read');
      
      assert.strictEqual(result.scope, undefined);
      assert.strictEqual(result.level, SCOPE_HIERARCHY['']);
    });

    it('should prefer territory over team over own', () => {
      const permissions = ['customers:read:own', 'customers:read:team', 'customers:read:territory'];
      const result = getBroadestScope(permissions, 'customers:read');
      
      assert.strictEqual(result.scope, 'territory');
      assert.strictEqual(result.level, SCOPE_HIERARCHY['territory']);
    });

    it('should return -1 level for no matching permissions', () => {
      const permissions = ['leads:read'];
      const result = getBroadestScope(permissions, 'customers:read');
      
      assert.strictEqual(result.level, -1);
    });
  });

  describe('SCOPE_HIERARCHY', () => {
    it('should have correct hierarchy levels', () => {
      assert.strictEqual(SCOPE_HIERARCHY[''] > SCOPE_HIERARCHY['territory'], true);
      assert.strictEqual(SCOPE_HIERARCHY['territory'] > SCOPE_HIERARCHY['team'], true);
      assert.strictEqual(SCOPE_HIERARCHY['team'] > SCOPE_HIERARCHY['own'], true);
      assert.strictEqual(SCOPE_HIERARCHY['own'] > SCOPE_HIERARCHY['self'], true);
    });
  });
});

