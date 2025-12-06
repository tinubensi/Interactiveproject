/**
 * Test role fixtures
 */

export interface TestRole {
  roleId: string;
  displayName: string;
  description?: string;
  permissions: string[];
  inheritsFrom?: string[];
  isSystem: boolean;
  isHighPrivilege?: boolean;
}

export const ROLES: Record<string, TestRole> = {
  superAdmin: {
    roleId: 'super-admin',
    displayName: 'Super Administrator',
    description: 'Full system access',
    permissions: ['*:*'],
    isSystem: true,
    isHighPrivilege: true,
  },
  complianceOfficer: {
    roleId: 'compliance-officer',
    displayName: 'Compliance Officer',
    description: 'Audit and compliance access',
    permissions: [
      'customers:read',
      'policies:read',
      'quotes:read',
      'audit:read',
      'audit:export',
      'compliance:*',
    ],
    isSystem: true,
    isHighPrivilege: true,
  },
  brokerManager: {
    roleId: 'broker-manager',
    displayName: 'Broker Manager',
    description: 'Team and territory management',
    permissions: [
      'staff:*',
      'customers:*',
      'leads:*',
      'quotes:*',
      'policies:*',
      'documents:*',
      'forms:*',
      'workflows:manage',
    ],
    isSystem: true,
  },
  seniorBroker: {
    roleId: 'senior-broker',
    displayName: 'Senior Broker',
    description: 'Full broker access with approval rights',
    permissions: [
      'customers:*',
      'leads:*',
      'quotes:*',
      'policies:*',
      'documents:*',
      'forms:*',
      'workflows:approve:team',
    ],
    inheritsFrom: ['broker'],
    isSystem: true,
  },
  broker: {
    roleId: 'broker',
    displayName: 'Broker',
    description: 'Standard broker access',
    permissions: [
      'customers:read:own',
      'customers:create',
      'customers:update:own',
      'leads:read:own',
      'leads:create',
      'leads:update:own',
      'quotes:read:own',
      'quotes:create',
      'policies:read:own',
      'documents:read:own',
      'documents:create',
      'forms:read',
      'forms:submit',
    ],
    isSystem: true,
  },
  readOnly: {
    roleId: 'read-only',
    displayName: 'Read Only',
    description: 'View-only access',
    permissions: [
      'customers:read',
      'leads:read',
      'quotes:read',
      'policies:read',
      'documents:read',
    ],
    isSystem: true,
  },
};

/**
 * Custom role for testing
 */
export const CUSTOM_ROLE: TestRole = {
  roleId: 'test-custom-role',
  displayName: 'Test Custom Role',
  description: 'Role created for testing',
  permissions: ['customers:read', 'leads:read'],
  isSystem: false,
};

