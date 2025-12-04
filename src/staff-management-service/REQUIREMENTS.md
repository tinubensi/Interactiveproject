# Staff Management Service Requirements

## Overview

The Staff Management Service manages staff profiles, team structures, territory assignments, and workload tracking. It is the source of truth for all internal employee data in the Nectaria platform.

### Service Identity

| Property | Value |
|----------|-------|
| **Service Name** | `staff-management-service` |
| **Runtime** | Azure Functions (Node.js 20, TypeScript) |
| **Database** | Azure Cosmos DB (`staff-db`) |
| **Event Bus** | Azure Event Grid |
| **Development Duration** | 1 day |

---

## 1. Scope

### In Scope

| Feature | Description |
|---------|-------------|
| Staff CRUD | Create, read, update staff profiles |
| Staff Status | Activate/deactivate staff members |
| Team Management | Create teams, manage membership |
| Territory Assignment | Assign staff to geographic territories |
| Workload Tracking | Track customers, leads, quotes per staff |
| Performance Metrics | Calculate MTD/YTD performance |
| License Alerts | Notify on expiring broker licenses |

### Out of Scope

| Feature | Responsible Service |
|---------|---------------------|
| Authentication | Authentication Service |
| Role/Permission Management | Authorization Service |
| Audit Logging | Audit Service |

---

## 2. Functional Requirements

### FR-STAFF-001: Staff CRUD

**Priority**: P1 (Must Have)

```
As a manager,
I want to create and manage staff profiles,
So that I can track employee information.
```

**Acceptance Criteria**:
- [ ] Create staff with profile info (name, email, phone, employee ID)
- [ ] Validate email matches Azure AD (for B2B users)
- [ ] Prevent duplicate email addresses
- [ ] Get staff by ID or email
- [ ] Update staff profile
- [ ] Activate/deactivate staff (soft delete)
- [ ] Publish StaffCreatedEvent, StaffUpdatedEvent, StaffDeactivatedEvent

### FR-STAFF-002: Team Management

**Priority**: P1 (Must Have)

```
As a manager,
I want to organize staff into teams,
So that I can manage groups of employees.
```

**Acceptance Criteria**:
- [ ] Create team with name and manager
- [ ] Add staff member to team
- [ ] Remove staff member from team
- [ ] List team members
- [ ] Update team details
- [ ] Delete empty teams only
- [ ] Staff can belong to one team only
- [ ] Publish TeamCreatedEvent, TeamMemberAddedEvent

### FR-STAFF-003: Territory Assignment

**Priority**: P1 (Must Have)

```
As a manager,
I want to assign staff to territories,
So that they can serve customers in those areas.
```

**Acceptance Criteria**:
- [ ] Assign one or more territories to staff
- [ ] Remove territory from staff
- [ ] List all territories
- [ ] Get staff in a specific territory
- [ ] Default territories: Dubai, Abu Dhabi, Sharjah, Ajman, RAK, Fujairah, UAQ
- [ ] Publish TerritoryAssignedEvent

### FR-STAFF-004: Workload Tracking

**Priority**: P2 (Should Have)

```
As a manager,
I want to see staff workload,
So that I can balance work distribution.
```

**Acceptance Criteria**:
- [ ] Track active customers count
- [ ] Track active leads count
- [ ] Track pending quotes count
- [ ] Track active policies count
- [ ] Update counts on relevant events (CustomerCreated, LeadCreated, etc.)
- [ ] Get current workload for staff member

### FR-STAFF-005: Performance Metrics

**Priority**: P2 (Should Have)

```
As a manager,
I want to see staff performance metrics,
So that I can evaluate productivity.
```

**Acceptance Criteria**:
- [ ] Calculate policies issued MTD/YTD
- [ ] Calculate premium generated MTD/YTD
- [ ] Calculate conversion rate (leads → policies)
- [ ] Update metrics on PolicyIssuedEvent
- [ ] Scheduled daily recalculation

### FR-STAFF-006: License Expiry Alerts

**Priority**: P2 (Should Have)

```
As a compliance officer,
I want to be alerted about expiring licenses,
So that staff can renew before expiration.
```

**Acceptance Criteria**:
- [ ] Store broker license info (number, issue date, expiry date)
- [ ] Identify licenses expiring within 30 days
- [ ] Publish LicenseExpiringEvent
- [ ] Provide API to query expiring licenses

---

## 3. API Specifications

### Staff APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/staff` | Create staff member |
| `GET` | `/api/staff` | List staff (paginated) |
| `GET` | `/api/staff/{staffId}` | Get staff by ID |
| `PUT` | `/api/staff/{staffId}` | Update staff profile |
| `PATCH` | `/api/staff/{staffId}/status` | Activate/deactivate |
| `GET` | `/api/staff/{staffId}/workload` | Get workload |
| `GET` | `/api/staff/{staffId}/performance` | Get performance |
| `GET` | `/api/staff/by-email/{email}` | Get by email |
| `GET` | `/api/staff/license-expiring` | Get expiring licenses |

### Team APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/teams` | Create team |
| `GET` | `/api/teams` | List all teams |
| `GET` | `/api/teams/{teamId}` | Get team by ID |
| `PUT` | `/api/teams/{teamId}` | Update team |
| `DELETE` | `/api/teams/{teamId}` | Delete team |
| `POST` | `/api/teams/{teamId}/members` | Add member |
| `DELETE` | `/api/teams/{teamId}/members/{staffId}` | Remove member |
| `GET` | `/api/teams/{teamId}/members` | List members |

### Territory APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/territories` | List all territories |
| `POST` | `/api/staff/{staffId}/territories` | Assign territories |
| `DELETE` | `/api/staff/{staffId}/territories/{territory}` | Remove territory |
| `GET` | `/api/territories/{territory}/staff` | Get staff in territory |

---

### Key API Examples

#### `POST /api/staff`

```json
// Request
{
  "profile": {
    "firstName": "John",
    "lastName": "Smith",
    "email": "john.smith@company.com",
    "phone": "+971501234567",
    "employeeId": "EMP-001"
  },
  "jobTitle": "Senior Insurance Broker",
  "department": "Sales",
  "license": {
    "licenseNumber": "BRK-2024-001",
    "licenseType": "Insurance Broker",
    "issueDate": "2024-01-01",
    "expiryDate": "2026-01-01",
    "issuingAuthority": "UAE Insurance Authority"
  }
}

// Response
{
  "id": "staff-uuid",
  "staffId": "staff-uuid",
  "profile": { ... },
  "jobTitle": "Senior Insurance Broker",
  "department": "Sales",
  "license": { ... },
  "status": "active",
  "workload": {
    "activeCustomers": 0,
    "activeLeads": 0,
    "pendingQuotes": 0,
    "activePolicies": 0
  },
  "territories": [],
  "createdAt": "2025-12-03T10:00:00Z"
}
```

#### `GET /api/staff/{staffId}/workload`

```json
// Response
{
  "staffId": "staff-uuid",
  "workload": {
    "activeCustomers": 45,
    "activeLeads": 12,
    "pendingQuotes": 8,
    "activePolicies": 120,
    "lastUpdated": "2025-12-03T10:00:00Z"
  }
}
```

#### `GET /api/staff/{staffId}/performance`

```json
// Response
{
  "staffId": "staff-uuid",
  "performance": {
    "policiesIssuedMTD": 8,
    "policiesIssuedYTD": 95,
    "premiumGeneratedMTD": 125000,
    "premiumGeneratedYTD": 1500000,
    "conversionRate": 32.5,
    "currency": "AED",
    "lastCalculated": "2025-12-03T00:00:00Z"
  }
}
```

---

## 4. Database Schema

**Database**: `staff-db`

### Container: `staff-members`
**Partition Key**: `/staffId`

```typescript
interface StaffMember {
  id: string;
  staffId: string;               // Partition key
  
  // Profile
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    employeeId: string;
    avatar?: string;
  };
  
  // Role & Position
  jobTitle: string;
  department: string;
  managerId?: string;
  
  // License
  license?: {
    licenseNumber: string;
    licenseType: string;
    issueDate: string;
    expiryDate: string;
    issuingAuthority: string;
  };
  
  // Assignment
  teamId?: string;
  territories: string[];
  
  // Workload (denormalized)
  workload: {
    activeCustomers: number;
    activeLeads: number;
    pendingQuotes: number;
    activePolicies: number;
    lastUpdated: string;
  };
  
  // Performance (calculated)
  performance: {
    policiesIssuedMTD: number;
    policiesIssuedYTD: number;
    premiumGeneratedMTD: number;
    premiumGeneratedYTD: number;
    conversionRate: number;
    lastCalculated: string;
  };
  
  // Status
  status: 'active' | 'inactive' | 'on_leave';
  activatedAt?: string;
  deactivatedAt?: string;
  deactivationReason?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}
```

### Container: `teams`
**Partition Key**: `/teamId`

```typescript
interface Team {
  id: string;
  teamId: string;                // Partition key
  name: string;
  description?: string;
  managerId: string;
  members: string[];             // Staff IDs
  territories?: string[];
  department: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}
```

### Container: `territories`
**Partition Key**: `/id`

```typescript
interface Territory {
  id: string;                    // e.g., 'dubai'
  name: string;                  // 'Dubai'
  region: string;                // 'UAE'
  description?: string;
  isActive: boolean;
}
```

---

## 5. Events

### Events Published

| Event Type | Trigger | Consumers |
|------------|---------|-----------|
| `staff.created` | New staff created | Audit Service |
| `staff.updated` | Staff profile updated | Audit Service |
| `staff.activated` | Staff activated | Audit Service |
| `staff.deactivated` | Staff deactivated | Audit, Auth Service |
| `staff.territory_assigned` | Territory assigned | Audit Service |
| `staff.team_joined` | Staff joined team | Audit Service |
| `staff.team_left` | Staff left team | Audit Service |
| `staff.license_expiring` | License expires in 30 days | Notification Service |
| `team.created` | New team created | Audit Service |
| `team.updated` | Team updated | Audit Service |

### Events Consumed

| Event Type | Source | Action |
|------------|--------|--------|
| `customer.created` | Customer Service | Update workload.activeCustomers |
| `lead.created` | Lead Service | Update workload.activeLeads |
| `lead.converted` | Lead Service | Update workload counters |
| `quote.created` | Quote Service | Update workload.pendingQuotes |
| `policy.issued` | Policy Service | Update workload, performance |
| `role.assigned` | Authorization Service | Sync role info |

---

## 6. Configuration

```typescript
interface StaffConfig {
  cosmosDb: {
    endpoint: string;
    databaseName: string;        // 'staff-db'
    containers: {
      members: string;           // 'staff-members'
      teams: string;             // 'teams'
      territories: string;       // 'territories'
    };
  };
  
  alerts: {
    licenseExpiryWarningDays: number;  // 30
    enableEmailAlerts: boolean;
  };
  
  performance: {
    calculationSchedule: string;       // '0 0 * * *' (daily)
  };
  
  defaultTerritories: string[];        // UAE Emirates
}
```

---

## 7. Test Cases

```typescript
describe('StaffManagementService', () => {
  describe('Staff CRUD', () => {
    it('should create staff with valid data');
    it('should validate required fields');
    it('should prevent duplicate email');
    it('should update staff profile');
    it('should deactivate staff member');
    it('should reactivate staff member');
    it('should publish StaffCreatedEvent');
  });

  describe('Team Management', () => {
    it('should create team');
    it('should add member to team');
    it('should remove member from team');
    it('should prevent staff in multiple teams');
    it('should list team members');
    it('should prevent deleting team with members');
  });

  describe('Territory Assignment', () => {
    it('should assign territory to staff');
    it('should remove territory from staff');
    it('should list staff in territory');
    it('should validate territory exists');
  });

  describe('Workload Tracking', () => {
    it('should update workload on CustomerCreatedEvent');
    it('should update workload on LeadCreatedEvent');
    it('should update workload on PolicyIssuedEvent');
    it('should return current workload');
  });

  describe('Performance Metrics', () => {
    it('should calculate policies issued MTD');
    it('should calculate premium generated MTD');
    it('should calculate conversion rate');
  });

  describe('License Alerts', () => {
    it('should identify expiring licenses (30 days)');
    it('should publish LicenseExpiringEvent');
  });
});
```

---

## 8. File Structure

```
staff-management-service/
├── src/
│   ├── functions/
│   │   ├── staff/
│   │   │   ├── CreateStaff.ts
│   │   │   ├── ListStaff.ts
│   │   │   ├── GetStaff.ts
│   │   │   ├── UpdateStaff.ts
│   │   │   ├── UpdateStaffStatus.ts
│   │   │   ├── GetStaffWorkload.ts
│   │   │   ├── GetStaffPerformance.ts
│   │   │   └── GetStaffByEmail.ts
│   │   ├── teams/
│   │   │   ├── CreateTeam.ts
│   │   │   ├── ListTeams.ts
│   │   │   ├── GetTeam.ts
│   │   │   ├── UpdateTeam.ts
│   │   │   ├── DeleteTeam.ts
│   │   │   ├── AddTeamMember.ts
│   │   │   ├── RemoveTeamMember.ts
│   │   │   └── ListTeamMembers.ts
│   │   ├── territories/
│   │   │   ├── ListTerritories.ts
│   │   │   ├── AssignTerritory.ts
│   │   │   ├── RemoveTerritory.ts
│   │   │   └── GetStaffInTerritory.ts
│   │   ├── events/
│   │   │   ├── CustomerCreatedHandler.ts
│   │   │   ├── LeadCreatedHandler.ts
│   │   │   ├── PolicyIssuedHandler.ts
│   │   │   └── RoleAssignedHandler.ts
│   │   ├── GetExpiringLicenses.ts
│   │   └── CalculatePerformance.ts  # Timer trigger
│   ├── lib/
│   │   ├── staffRepository.ts
│   │   ├── teamRepository.ts
│   │   ├── territoryRepository.ts
│   │   ├── workloadService.ts
│   │   ├── performanceCalculator.ts
│   │   ├── eventPublisher.ts
│   │   ├── config.ts
│   │   └── cosmosClient.ts
│   ├── models/
│   │   ├── StaffMember.ts
│   │   ├── Team.ts
│   │   └── Territory.ts
│   └── tests/
│       ├── staffCrud.test.ts
│       ├── teamManagement.test.ts
│       ├── territoryAssignment.test.ts
│       ├── workloadTracking.test.ts
│       └── performanceMetrics.test.ts
├── scripts/
│   └── seedTerritories.ts
├── host.json
├── local.settings.json
├── package.json
├── tsconfig.json
└── REQUIREMENTS.md
```

---

## 9. Default Territories

```typescript
const defaultTerritories: Territory[] = [
  { id: 'dubai', name: 'Dubai', region: 'UAE', isActive: true },
  { id: 'abu-dhabi', name: 'Abu Dhabi', region: 'UAE', isActive: true },
  { id: 'sharjah', name: 'Sharjah', region: 'UAE', isActive: true },
  { id: 'ajman', name: 'Ajman', region: 'UAE', isActive: true },
  { id: 'rak', name: 'Ras Al Khaimah', region: 'UAE', isActive: true },
  { id: 'fujairah', name: 'Fujairah', region: 'UAE', isActive: true },
  { id: 'uaq', name: 'Umm Al Quwain', region: 'UAE', isActive: true },
];
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
| Azure Cosmos DB | Store staff data |
| Azure Event Grid | Publish/Subscribe events |
| Azure Functions | Compute |

---

**Document Version**: 1.0  
**Created**: December 3, 2025  
**Status**: APPROVED

