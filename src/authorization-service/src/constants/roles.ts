/**
 * Role Definitions and Azure AD Group Mappings
 * Inline constants for authorization service
 */

export interface RoleDefinition {
  roleId: string;
  displayName: string;
  description: string;
  permissions: string[];
  azureAdGroup?: string;
  inheritsFrom?: string[];
  isSystem: boolean;
  isHighPrivilege: boolean;
  isActive: boolean;
}

/**
 * Default System Roles
 */
export const DEFAULT_ROLES: RoleDefinition[] = [
  {
    roleId: 'super-admin',
    displayName: 'Super Administrator',
    description: 'Full system access with all permissions',
    permissions: ['*'],
    azureAdGroup: 'Nectaria-SuperAdmins',
    inheritsFrom: [],
    isSystem: true,
    isHighPrivilege: true,
    isActive: true,
  },
  {
    roleId: 'admin',
    displayName: 'Administrator',
    description: 'System administrator with most permissions',
    permissions: [
      'users:*',
      'roles:*',
      'leads:*',
      'customers:*',
      'policies:*',
      'quotations:*',
      'documents:*',
      'workflows:*',
      'forms:*',
      'settings:read',
      'settings:write',
      'audit:read',
    ],
    azureAdGroup: 'Nectaria-Admins',
    inheritsFrom: [],
    isSystem: true,
    isHighPrivilege: true,
    isActive: true,
  },
  {
    roleId: 'manager',
    displayName: 'Manager',
    description: 'Team manager with oversight capabilities',
    permissions: [
      'leads:read',
      'leads:write',
      'leads:assign',
      'customers:read',
      'customers:write',
      'policies:read',
      'quotations:read',
      'quotations:write',
      'quotations:approve',
      'documents:read',
      'documents:write',
      'workflows:read',
      'forms:read',
      'audit:read',
      'reports:read',
    ],
    azureAdGroup: 'Nectaria-Managers',
    inheritsFrom: [],
    isSystem: true,
    isHighPrivilege: false,
    isActive: true,
  },
  {
    roleId: 'underwriter',
    displayName: 'Underwriter',
    description: 'Insurance underwriter with quotation and policy permissions',
    permissions: [
      'leads:read',
      'leads:write',
      'customers:read',
      'customers:write',
      'policies:read',
      'policies:write',
      'quotations:read',
      'quotations:write',
      'quotations:approve',
      'documents:read',
      'documents:write',
      'workflows:read',
      'forms:read',
    ],
    azureAdGroup: 'Nectaria-Underwriters',
    inheritsFrom: [],
    isSystem: true,
    isHighPrivilege: false,
    isActive: true,
  },
  {
    roleId: 'sales-agent',
    displayName: 'Sales Agent',
    description: 'Sales agent with lead and customer management',
    permissions: [
      'leads:read',
      'leads:write',
      'leads:create',
      'customers:read',
      'customers:write',
      'customers:create',
      'quotations:read',
      'quotations:create',
      'documents:read',
      'documents:upload',
      'workflows:read',
      'forms:read',
      'forms:submit',
    ],
    azureAdGroup: 'Nectaria-SalesAgents',
    inheritsFrom: [],
    isSystem: true,
    isHighPrivilege: false,
    isActive: true,
  },
  {
    roleId: 'customer-service',
    displayName: 'Customer Service',
    description: 'Customer service representative',
    permissions: [
      'leads:read',
      'customers:read',
      'customers:write',
      'policies:read',
      'quotations:read',
      'documents:read',
      'documents:upload',
      'workflows:read',
      'forms:read',
    ],
    azureAdGroup: 'Nectaria-CustomerService',
    inheritsFrom: [],
    isSystem: true,
    isHighPrivilege: false,
    isActive: true,
  },
  {
    roleId: 'auditor',
    displayName: 'Auditor',
    description: 'System auditor with read-only access to audit logs',
    permissions: [
      'audit:read',
      'leads:read',
      'customers:read',
      'policies:read',
      'quotations:read',
      'documents:read',
      'workflows:read',
      'forms:read',
      'reports:read',
    ],
    azureAdGroup: 'Nectaria-Auditors',
    inheritsFrom: [],
    isSystem: true,
    isHighPrivilege: false,
    isActive: true,
  },
  {
    roleId: 'viewer',
    displayName: 'Viewer',
    description: 'Read-only access to most resources',
    permissions: [
      'leads:read',
      'customers:read',
      'policies:read',
      'quotations:read',
      'documents:read',
      'workflows:read',
      'forms:read',
    ],
    azureAdGroup: 'Nectaria-Viewers',
    inheritsFrom: [],
    isSystem: true,
    isHighPrivilege: false,
    isActive: true,
  },
];

/**
 * Azure AD Group to Role Mapping
 * Maps Azure AD group names/IDs to application role IDs
 */
export const AZURE_AD_GROUP_MAPPING: Record<string, string> = {
  'Nectaria-SuperAdmins': 'super-admin',
  'Nectaria-Admins': 'admin',
  'Nectaria-Managers': 'manager',
  'Nectaria-Underwriters': 'underwriter',
  'Nectaria-SalesAgents': 'sales-agent',
  'Nectaria-CustomerService': 'customer-service',
  'Nectaria-Auditors': 'auditor',
  'Nectaria-Viewers': 'viewer',
};

