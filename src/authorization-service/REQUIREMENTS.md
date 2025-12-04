# Authorization Service Requirements

## Overview

The Authorization Service provides centralized Role-Based Access Control (RBAC) and permission management. All backend services call this service to check if a user has permission to perform an action.

### Service Identity

| Property | Value |
|----------|-------|
| **Service Name** | `authorization-service` |
| **Runtime** | Azure Functions (Node.js 20, TypeScript) |
| **Database** | Azure Cosmos DB (`authz-db`) |
| **Event Bus** | Azure Event Grid |
| **Development Duration** | 2 days |

---

## 1. Scope

### In Scope

| Feature | Description |
|---------|-------------|
| Role Definitions | CRUD operations for roles |
| Permission Management | Define and manage permissions |
| User Role Assignments | Assign/remove roles from users |
| Azure AD Group Sync | Map Azure AD groups to application roles |
| Permission Checks | Validate user permissions |
| Resource-Level Permissions | Check ownership/territory-based access |
| Permission Caching | Cache permission results (5 min) |

### Out of Scope

| Feature | Responsible Service |
|---------|---------------------|
| User Authentication | Authentication Service |
| Session Management | Authentication Service |
| Staff Data | Staff Management Service |

---

## 2. Functional Requirements

### FR-AUTHZ-001: Role Management

**Priority**: P1 (Must Have)

```
As an administrator,
I want to manage roles and their permissions,
So that I can control access to system resources.
```

**Acceptance Criteria**:
- [ ] Create role with name, description, and permissions
- [ ] List all roles
- [ ] Get role by ID
- [ ] Update role permissions
- [ ] Delete role (non-system roles only)
- [ ] Prevent deletion of system roles
- [ ] Publish RoleCreatedEvent, RoleUpdatedEvent, RoleDeletedEvent

### FR-AUTHZ-002: Azure AD Group Sync

**Priority**: P1 (Must Have)

```
As an IT administrator,
I want user roles to be synced from Azure AD groups,
So that I can manage access centrally.
```

**Azure AD Group Mappings**:
| Azure AD Group | Application Role |
|----------------|------------------|
| `Nectaria-SuperAdmins` | `super-admin` |
| `Nectaria-ComplianceOfficers` | `compliance-officer` |
| `Nectaria-BrokerManagers` | `broker-manager` |
| `Nectaria-SeniorBrokers` | `senior-broker` |
| `Nectaria-JuniorBrokers` | `junior-broker` |
| `Nectaria-Underwriters` | `underwriter` |
| `Nectaria-CustomerSupport` | `customer-support` |

### FR-AUTHZ-003: Permission Check

**Priority**: P1 (Must Have)

```
As a backend service,
I want to verify if a user has a specific permission,
So that I can enforce access control.
```

**Acceptance Criteria**:
- [ ] Check if user has permission (e.g., `customers:read`)
- [ ] Support wildcard permissions (`*:*` for super-admin)
- [ ] Support scoped permissions (`:own`, `:team`, `:territory`)
- [ ] Cache results for 5 minutes
- [ ] Invalidate cache on role changes
- [ ] Return authorized/unauthorized with reason

### FR-AUTHZ-004: Resource-Level Permissions

**Priority**: P1 (Must Have)

```
As a broker,
I want to only access customers in my territory,
So that customer data is properly segregated.
```

**Acceptance Criteria**:
- [ ] Check resource ownership for `:own` scope
- [ ] Check team membership for `:team` scope
- [ ] Check territory assignment for `:territory` scope
- [ ] Super-admins bypass resource checks
- [ ] Return 403 for unauthorized resource access

---

## 3. API Specifications

### Role Management APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/authz/roles` | Create role |
| `GET` | `/api/authz/roles` | List all roles |
| `GET` | `/api/authz/roles/{roleId}` | Get role by ID |
| `PUT` | `/api/authz/roles/{roleId}` | Update role |
| `DELETE` | `/api/authz/roles/{roleId}` | Delete role |

### User Role APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/authz/users/{userId}/roles` | Get user's roles |
| `POST` | `/api/authz/users/{userId}/roles` | Assign role to user |
| `DELETE` | `/api/authz/users/{userId}/roles/{roleId}` | Remove role |
| `POST` | `/api/authz/users/{userId}/sync` | Sync from Azure AD |

### Permission Check APIs (Internal)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/authz/check` | Check permission |
| `POST` | `/api/authz/check-resource` | Check resource permission |
| `GET` | `/api/authz/users/{userId}/permissions` | Get all permissions |

---

### Key API Examples

#### `POST /api/authz/check`

```json
// Request
POST /api/authz/check
X-Service-Key: {internal-service-key}

{
  "userId": "user-uuid",
  "permission": "customers:read"
}

// Response (Authorized)
{
  "authorized": true,
  "userId": "user-uuid",
  "roles": ["senior-broker"]
}

// Response (Unauthorized)
{
  "authorized": false,
  "reason": "insufficient_permissions",
  "required": "customers:delete",
  "userPermissions": ["customers:read", "customers:create"]
}
```

#### `POST /api/authz/check-resource`

```json
// Request
POST /api/authz/check-resource
X-Service-Key: {internal-service-key}

{
  "userId": "user-uuid",
  "permission": "customers:read",
  "resource": {
    "type": "customer",
    "id": "cust-uuid",
    "ownerId": "other-user",
    "territory": "Dubai"
  }
}

// Response
{
  "authorized": true,
  "reason": "territory_match"
}
```

---

## 4. Database Schema

**Database**: `authz-db`

### Container: `role-definitions`
**Partition Key**: `/roleId`

```typescript
interface RoleDefinition {
  id: string;
  roleId: string;                // Partition key
  displayName: string;
  description: string;
  permissions: string[];         // ['customers:read', 'quotes:approve']
  azureAdGroup?: string;         // Mapped Azure AD group
  inheritsFrom?: string[];       // Parent roles
  isSystem: boolean;             // Cannot delete system roles
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Container: `user-roles`
**Partition Key**: `/userId`

```typescript
interface UserRole {
  id: string;
  userId: string;                // Partition key
  email: string;
  roles: string[];               // ['senior-broker']
  effectivePermissions: string[];// Computed from roles
  azureAdGroups: string[];       // Original Azure AD groups
  territory?: string[];          // Resource scope
  teamId?: string;               // Team scope
  source: 'azure_ad' | 'manual';
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Container: `permission-cache`
**Partition Key**: `/userId`

```typescript
interface PermissionCache {
  id: string;
  userId: string;
  permissions: string[];
  roles: string[];
  territory: string[];
  teamId?: string;
  cachedAt: string;
  expiresAt: string;
  ttl: number;                   // 300 seconds
}
```

---

## 5. Default Roles

```typescript
const defaultRoles = [
  {
    id: 'super-admin',
    displayName: 'Super Administrator',
    permissions: ['*:*'],
    azureAdGroup: 'Nectaria-SuperAdmins',
    isSystem: true,
  },
  {
    id: 'compliance-officer',
    displayName: 'Compliance Officer',
    permissions: [
      'customers:read', 'policies:read', 'quotes:read',
      'audit:read', 'audit:export', 'compliance:*'
    ],
    azureAdGroup: 'Nectaria-ComplianceOfficers',
    isSystem: true,
  },
  {
    id: 'broker-manager',
    displayName: 'Broker Manager',
    permissions: [
      'staff:*', 'customers:*', 'leads:*',
      'quotes:*', 'policies:*', 'documents:*',
      'forms:*', 'workflows:manage'
    ],
    azureAdGroup: 'Nectaria-BrokerManagers',
    isSystem: true,
  },
  {
    id: 'senior-broker',
    displayName: 'Senior Broker',
    permissions: [
      'customers:create', 'customers:read:own', 'customers:update:own',
      'leads:create', 'leads:read:own', 'leads:update:own',
      'quotes:create', 'quotes:read', 'quotes:approve',
      'policies:create', 'policies:read', 'policies:endorse',
      'documents:read', 'documents:upload',
      'staff:read:team', 'forms:read'
    ],
    azureAdGroup: 'Nectaria-SeniorBrokers',
    isSystem: true,
  },
  {
    id: 'junior-broker',
    displayName: 'Junior Broker',
    permissions: [
      'customers:create', 'customers:read:own', 'customers:update:own',
      'leads:create', 'leads:read:own', 'leads:update:own',
      'quotes:create', 'quotes:read',
      'policies:read',
      'documents:read', 'documents:upload',
      'forms:read'
    ],
    azureAdGroup: 'Nectaria-JuniorBrokers',
    isSystem: true,
  },
  {
    id: 'underwriter',
    displayName: 'Underwriter',
    permissions: [
      'quotes:read', 'quotes:underwrite',
      'documents:read:medical',
      'policies:read', 'staff:read:team'
    ],
    azureAdGroup: 'Nectaria-Underwriters',
    isSystem: true,
  },
  {
    id: 'customer-support',
    displayName: 'Customer Support',
    permissions: [
      'customers:read', 'policies:read', 'quotes:read',
      'leads:read', 'documents:read', 'staff:read:team'
    ],
    azureAdGroup: 'Nectaria-CustomerSupport',
    isSystem: true,
  },
  {
    id: 'customer',
    displayName: 'Customer',
    permissions: [
      'customers:read:self', 'customers:update:self',
      'policies:read:own', 'quotes:read:own',
      'documents:read:own', 'documents:upload:own',
      'forms:read'
    ],
    isSystem: true,
  },
];
```

---

## 6. Permission Matrix

| Permission | super-admin | compliance | broker-mgr | senior-broker | junior-broker | underwriter | support | customer |
|------------|:-----------:|:----------:|:----------:|:-------------:|:-------------:|:-----------:|:-------:|:--------:|
| `customers:create` | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `customers:read` | ✅ | ✅ | ✅ | own | own | ❌ | ✅ | self |
| `customers:update` | ✅ | ❌ | ✅ | own | own | ❌ | ❌ | self |
| `customers:delete` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `quotes:approve` | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `quotes:underwrite` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `audit:read` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `audit:export` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `staff:*` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `roles:manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 7. Events

### Events Published

| Event Type | Trigger | Consumers |
|------------|---------|-----------|
| `role.created` | New role created | Audit Service |
| `role.updated` | Role permissions changed | Audit Service |
| `role.deleted` | Role deleted | Audit Service |
| `role.assigned` | Role assigned to user | Audit Service, Staff Service |
| `role.removed` | Role removed from user | Audit Service |
| `permission.denied` | Access denied | Audit Service |

---

## 8. Test Cases

```typescript
describe('AuthorizationService', () => {
  describe('Role Management', () => {
    it('should create role with permissions');
    it('should prevent creating role with reserved ID');
    it('should update role permissions');
    it('should prevent deleting system roles');
    it('should validate permission format');
    it('should publish RoleCreatedEvent');
  });

  describe('Role Assignment', () => {
    it('should assign role to user');
    it('should remove role from user');
    it('should sync roles from Azure AD groups');
    it('should compute effective permissions');
    it('should handle role inheritance');
    it('should publish RoleAssignedEvent');
  });

  describe('Permission Check', () => {
    it('should return authorized for valid permission');
    it('should return unauthorized for missing permission');
    it('should handle wildcard permissions (*:*)');
    it('should check :own scope against resource owner');
    it('should check :team scope against team membership');
    it('should check :territory scope against assignment');
    it('should cache results for 5 minutes');
    it('should invalidate cache on role change');
  });

  describe('Azure AD Sync', () => {
    it('should map Azure AD groups to roles');
    it('should handle multiple group memberships');
    it('should ignore unmapped groups');
    it('should update roles on login');
  });
});
```

---

## 9. File Structure

```
authorization-service/
├── src/
│   ├── functions/
│   │   ├── roles/
│   │   │   ├── CreateRole.ts
│   │   │   ├── GetRoles.ts
│   │   │   ├── GetRole.ts
│   │   │   ├── UpdateRole.ts
│   │   │   └── DeleteRole.ts
│   │   ├── users/
│   │   │   ├── GetUserRoles.ts
│   │   │   ├── AssignRole.ts
│   │   │   ├── RemoveRole.ts
│   │   │   └── SyncFromAzureAd.ts
│   │   ├── CheckPermission.ts
│   │   ├── CheckResourcePermission.ts
│   │   └── GetUserPermissions.ts
│   ├── lib/
│   │   ├── roleRepository.ts
│   │   ├── userRoleRepository.ts
│   │   ├── permissionResolver.ts
│   │   ├── resourceChecker.ts
│   │   ├── permissionCache.ts
│   │   ├── azureAdMapper.ts
│   │   ├── eventPublisher.ts
│   │   ├── config.ts
│   │   └── cosmosClient.ts
│   ├── models/
│   │   ├── RoleDefinition.ts
│   │   ├── UserRole.ts
│   │   └── PermissionCache.ts
│   └── tests/
│       ├── roleManagement.test.ts
│       ├── roleAssignment.test.ts
│       ├── permissionCheck.test.ts
│       └── azureAdSync.test.ts
├── scripts/
│   └── seedRoles.ts
├── host.json
├── local.settings.json
├── package.json
├── tsconfig.json
└── REQUIREMENTS.md
```

---

## 10. Dependencies

### NPM Packages

```json
{
  "dependencies": {
    "@azure/cosmos": "^4.0.0",
    "@azure/functions": "^4.0.0",
    "@azure/event-grid": "^5.0.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

### Azure Resources

| Resource | Purpose |
|----------|---------|
| Azure Cosmos DB | Store roles and assignments |
| Azure Event Grid | Publish role events |
| Azure Functions | Compute |

---

**Document Version**: 1.0  
**Created**: December 3, 2025  
**Status**: APPROVED

