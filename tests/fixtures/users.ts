/**
 * Test user fixtures
 */

export interface TestUser {
  userId: string;
  email: string;
  displayName: string;
  roles: string[];
  teamId?: string;
  territoryId?: string;
  organizationId?: string;
}

export const USERS: Record<string, TestUser> = {
  superAdmin: {
    userId: 'super-admin-001',
    email: 'superadmin@nectaria.com',
    displayName: 'Super Administrator',
    roles: ['super-admin'],
    organizationId: 'org-001',
  },
  complianceOfficer: {
    userId: 'compliance-001',
    email: 'compliance@nectaria.com',
    displayName: 'Compliance Officer',
    roles: ['compliance-officer'],
    organizationId: 'org-001',
  },
  brokerManager: {
    userId: 'manager-001',
    email: 'manager@nectaria.com',
    displayName: 'Broker Manager',
    roles: ['broker-manager'],
    teamId: 'team-001',
    territoryId: 'territory-001',
    organizationId: 'org-001',
  },
  seniorBroker: {
    userId: 'senior-broker-001',
    email: 'senior.broker@nectaria.com',
    displayName: 'Senior Broker',
    roles: ['senior-broker'],
    teamId: 'team-001',
    territoryId: 'territory-001',
    organizationId: 'org-001',
  },
  broker: {
    userId: 'broker-001',
    email: 'broker@nectaria.com',
    displayName: 'Test Broker',
    roles: ['broker'],
    teamId: 'team-001',
    territoryId: 'territory-001',
    organizationId: 'org-001',
  },
  readOnlyUser: {
    userId: 'readonly-001',
    email: 'readonly@nectaria.com',
    displayName: 'Read Only User',
    roles: ['read-only'],
    organizationId: 'org-001',
  },
  noRoleUser: {
    userId: 'norole-001',
    email: 'norole@nectaria.com',
    displayName: 'No Role User',
    roles: [],
    organizationId: 'org-001',
  },
};

/**
 * Create auth headers for a test user
 */
export function createUserHeaders(user: TestUser): Record<string, string> {
  const userContext = {
    userId: user.userId,
    email: user.email,
    roles: user.roles,
    teamId: user.teamId,
    territoryId: user.territoryId,
    organizationId: user.organizationId,
  };
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer test-token-${user.userId}`,
    'X-User-Context': Buffer.from(JSON.stringify(userContext)).toString('base64'),
  };
}

/**
 * Create headers for service-to-service communication
 */
export function createServiceHeaders(internalKey: string = 'test-service-key'): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Service-Key': internalKey,
  };
}

