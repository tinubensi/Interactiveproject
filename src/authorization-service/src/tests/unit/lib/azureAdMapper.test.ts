/**
 * Azure AD Mapper Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  mapGroupsToRoles,
  getGroupMapping,
  isGroupMapped,
  getRoleForGroup,
  getGroupForRole,
  calculateRoleChanges,
  validateGroups,
} from '../../../lib/azureAdMapper';

describe('azureAdMapper', () => {
  describe('mapGroupsToRoles', () => {
    it('should map known Azure AD groups to roles', () => {
      const groups = ['Nectaria-SeniorBrokers', 'Nectaria-JuniorBrokers'];
      const roles = mapGroupsToRoles(groups);
      
      assert.deepStrictEqual(roles, ['junior-broker', 'senior-broker']);
    });

    it('should ignore unknown groups', () => {
      const groups = ['Nectaria-SeniorBrokers', 'Unknown-Group', 'Random-Group'];
      const roles = mapGroupsToRoles(groups);
      
      assert.deepStrictEqual(roles, ['senior-broker']);
    });

    it('should return empty array for no mapped groups', () => {
      const groups = ['Unknown-Group', 'Random-Group'];
      const roles = mapGroupsToRoles(groups);
      
      assert.deepStrictEqual(roles, []);
    });

    it('should not duplicate roles', () => {
      const groups = ['Nectaria-SeniorBrokers', 'Nectaria-SeniorBrokers'];
      const roles = mapGroupsToRoles(groups);
      
      assert.deepStrictEqual(roles, ['senior-broker']);
    });

    it('should return sorted roles', () => {
      const groups = ['Nectaria-CustomerSupport', 'Nectaria-BrokerManagers', 'Nectaria-Underwriters'];
      const roles = mapGroupsToRoles(groups);
      
      assert.deepStrictEqual(roles, ['broker-manager', 'customer-support', 'underwriter']);
    });
  });

  describe('getGroupMapping', () => {
    it('should return the group mapping', () => {
      const mapping = getGroupMapping();
      
      assert.strictEqual(mapping['Nectaria-SuperAdmins'], 'super-admin');
      assert.strictEqual(mapping['Nectaria-SeniorBrokers'], 'senior-broker');
    });

    it('should return a copy of the mapping', () => {
      const mapping1 = getGroupMapping();
      const mapping2 = getGroupMapping();
      
      assert.notStrictEqual(mapping1, mapping2);
    });
  });

  describe('isGroupMapped', () => {
    it('should return true for mapped groups', () => {
      assert.strictEqual(isGroupMapped('Nectaria-SuperAdmins'), true);
      assert.strictEqual(isGroupMapped('Nectaria-JuniorBrokers'), true);
    });

    it('should return false for unknown groups', () => {
      assert.strictEqual(isGroupMapped('Unknown-Group'), false);
      assert.strictEqual(isGroupMapped(''), false);
    });
  });

  describe('getRoleForGroup', () => {
    it('should return role for known group', () => {
      assert.strictEqual(getRoleForGroup('Nectaria-SuperAdmins'), 'super-admin');
      assert.strictEqual(getRoleForGroup('Nectaria-ComplianceOfficers'), 'compliance-officer');
    });

    it('should return undefined for unknown group', () => {
      assert.strictEqual(getRoleForGroup('Unknown-Group'), undefined);
    });
  });

  describe('getGroupForRole', () => {
    it('should return group for known role', () => {
      assert.strictEqual(getGroupForRole('super-admin'), 'Nectaria-SuperAdmins');
      assert.strictEqual(getGroupForRole('senior-broker'), 'Nectaria-SeniorBrokers');
    });

    it('should return undefined for role without group mapping', () => {
      assert.strictEqual(getGroupForRole('custom-role'), undefined);
    });
  });

  describe('calculateRoleChanges', () => {
    it('should calculate roles added', () => {
      const previous = ['Nectaria-JuniorBrokers'];
      const current = ['Nectaria-JuniorBrokers', 'Nectaria-SeniorBrokers'];
      
      const result = calculateRoleChanges(previous, current);
      
      assert.deepStrictEqual(result.previousRoles, ['junior-broker']);
      assert.deepStrictEqual(result.currentRoles, ['junior-broker', 'senior-broker']);
      assert.deepStrictEqual(result.rolesAdded, ['senior-broker']);
      assert.deepStrictEqual(result.rolesRemoved, []);
    });

    it('should calculate roles removed', () => {
      const previous = ['Nectaria-JuniorBrokers', 'Nectaria-SeniorBrokers'];
      const current = ['Nectaria-JuniorBrokers'];
      
      const result = calculateRoleChanges(previous, current);
      
      assert.deepStrictEqual(result.rolesAdded, []);
      assert.deepStrictEqual(result.rolesRemoved, ['senior-broker']);
    });

    it('should calculate both added and removed', () => {
      const previous = ['Nectaria-JuniorBrokers'];
      const current = ['Nectaria-SeniorBrokers'];
      
      const result = calculateRoleChanges(previous, current);
      
      assert.deepStrictEqual(result.rolesAdded, ['senior-broker']);
      assert.deepStrictEqual(result.rolesRemoved, ['junior-broker']);
    });

    it('should handle no changes', () => {
      const previous = ['Nectaria-SeniorBrokers'];
      const current = ['Nectaria-SeniorBrokers'];
      
      const result = calculateRoleChanges(previous, current);
      
      assert.deepStrictEqual(result.rolesAdded, []);
      assert.deepStrictEqual(result.rolesRemoved, []);
    });
  });

  describe('validateGroups', () => {
    it('should separate valid and unknown groups', () => {
      const groups = ['Nectaria-SuperAdmins', 'Unknown-Group', 'Nectaria-SeniorBrokers'];
      const result = validateGroups(groups);
      
      assert.deepStrictEqual(result.valid, ['Nectaria-SuperAdmins', 'Nectaria-SeniorBrokers']);
      assert.deepStrictEqual(result.unknown, ['Unknown-Group']);
    });

    it('should return all valid for known groups', () => {
      const groups = ['Nectaria-SuperAdmins', 'Nectaria-SeniorBrokers'];
      const result = validateGroups(groups);
      
      assert.deepStrictEqual(result.valid, groups);
      assert.deepStrictEqual(result.unknown, []);
    });

    it('should return all unknown for unknown groups', () => {
      const groups = ['Unknown1', 'Unknown2'];
      const result = validateGroups(groups);
      
      assert.deepStrictEqual(result.valid, []);
      assert.deepStrictEqual(result.unknown, groups);
    });
  });
});

