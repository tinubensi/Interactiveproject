# Audit Service Requirements

## Overview

The Audit Service is the centralized logging system for all security and business events in the Nectaria platform. It provides compliance reporting, forensic analysis capabilities, and immutable audit trails. All audit logs are **append-only** and retained indefinitely for compliance.

### Service Identity

| Property | Value |
|----------|-------|
| **Service Name** | `audit-service` |
| **Runtime** | Azure Functions (Node.js 20, TypeScript) |
| **Database** | Azure Cosmos DB (`audit-db`) |
| **Event Bus** | Azure Event Grid (Subscriber) |
| **Development Duration** | 1 day |

---

## Table of Contents

1. [Scope](#1-scope)
2. [Functional Requirements](#2-functional-requirements)
3. [API Specifications](#3-api-specifications)
4. [Database Schema](#4-database-schema)
5. [Events](#5-events)
6. [Configuration](#6-configuration)
7. [Security](#7-security)
8. [Test Cases](#8-test-cases)
9. [File Structure](#9-file-structure)
10. [Dependencies](#10-dependencies)

---

## 1. Scope

### In Scope

| Feature | Description |
|---------|-------------|
| Event Subscription | Subscribe to all domain events via Event Grid |
| Audit Log Storage | Store all events in immutable Cosmos DB container |
| Query APIs | Query audit trail by entity, user, date range |
| Export | Export audit logs to PDF and CSV |
| Compliance Reporting | Generate compliance reports |
| Statistics | Provide audit statistics and dashboards |

### Out of Scope

| Feature | Responsible Service |
|---------|---------------------|
| Authentication | Authentication Service |
| Authorization decisions | Authorization Service |
| Real-time alerting | Future: Alerting Service |
| Log aggregation (infrastructure) | Azure Monitor |

---

## 2. Functional Requirements

### FR-AUDIT-001: Event Subscription

**Priority**: P1 (Must Have)

```
As the audit system,
I want to automatically receive all domain events,
So that every action in the system is logged for compliance.
```

**Acceptance Criteria**:
- [ ] Subscribe to all events matching pattern `*.*`
- [ ] Handle authentication events (`auth.*`)
- [ ] Handle customer events (`customer.*`)
- [ ] Handle staff events (`staff.*`)
- [ ] Handle policy events (`policy.*`)
- [ ] Handle quote events (`quote.*`)
- [ ] Handle document events (`document.*`)
- [ ] Handle role/permission events (`role.*`)
- [ ] Handle form events (`form.*`)
- [ ] Handle workflow events (`workflow.*`)
- [ ] Process events within 5 seconds of receipt
- [ ] Never lose events (at-least-once delivery)

### FR-AUDIT-002: Audit Log Storage

**Priority**: P1 (Must Have)

```
As a compliance officer,
I want all system actions to be permanently logged,
So that we have a complete audit trail for regulatory compliance.
```

**Acceptance Criteria**:
- [ ] Store all events in Cosmos DB with no TTL (permanent)
- [ ] Logs are append-only (no updates or deletes)
- [ ] Each log includes: timestamp, actor, action, entity, before/after state
- [ ] Each log includes: IP address, user agent, request ID
- [ ] Logs are categorized by type (auth, data, security, etc.)
- [ ] Logs include severity level (info, warning, critical)
- [ ] PII is sanitized before storage (masked or hashed)

### FR-AUDIT-003: Query by Entity

**Priority**: P1 (Must Have)

```
As a compliance officer,
I want to query the audit trail for a specific entity,
So that I can investigate all actions related to that entity.
```

**Acceptance Criteria**:
- [ ] Query by entity type and entity ID
- [ ] Return all audit logs for that entity
- [ ] Results ordered by timestamp (newest first)
- [ ] Support pagination with continuation tokens
- [ ] Response time < 500ms for typical queries

### FR-AUDIT-004: Query by User

**Priority**: P1 (Must Have)

```
As a compliance officer,
I want to query all actions performed by a specific user,
So that I can review their activity history.
```

**Acceptance Criteria**:
- [ ] Query by user ID or email
- [ ] Return all actions performed by that user
- [ ] Include both successful and failed actions
- [ ] Support date range filtering
- [ ] Support action type filtering

### FR-AUDIT-005: Advanced Search

**Priority**: P1 (Must Have)

```
As a compliance officer,
I want to search audit logs with multiple filters,
So that I can find specific events quickly.
```

**Acceptance Criteria**:
- [ ] Filter by date range (required)
- [ ] Filter by entity type
- [ ] Filter by action type
- [ ] Filter by actor (user ID)
- [ ] Filter by severity
- [ ] Filter by category
- [ ] Full-text search on metadata (optional)
- [ ] Combine multiple filters with AND logic
- [ ] Support pagination

### FR-AUDIT-006: Export to PDF/CSV

**Priority**: P2 (Should Have)

```
As a compliance officer,
I want to export audit logs to PDF and CSV,
So that I can share reports with regulators and auditors.
```

**Acceptance Criteria**:
- [ ] Export search results to PDF format
- [ ] Export search results to CSV format
- [ ] PDF includes header with export date, filters used
- [ ] CSV includes all fields with proper escaping
- [ ] Maximum 100,000 records per export
- [ ] Export files stored in Azure Blob Storage
- [ ] Return download URL (valid for 1 hour)

### FR-AUDIT-007: Statistics

**Priority**: P2 (Should Have)

```
As an administrator,
I want to see audit statistics,
So that I can monitor system activity.
```

**Acceptance Criteria**:
- [ ] Total events by category (today, week, month)
- [ ] Total events by action type
- [ ] Total events by user (top 10)
- [ ] Security events count
- [ ] Failed login attempts count
- [ ] Data mutation counts (create, update, delete)

---

## 3. API Specifications

### 3.1 Query Endpoints

#### `GET /api/audit/entity/{entityType}/{entityId}`

Get audit trail for a specific entity.

**Request**:
```http
GET /api/audit/entity/customer/cust-123-uuid
Cookie: nectaria_access_token=eyJ...
```

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Max results (default: 50, max: 100) |
| `continuationToken` | string | No | Pagination token |

**Response**:
```json
HTTP/1.1 200 OK

{
  "entityType": "customer",
  "entityId": "cust-123-uuid",
  "totalCount": 15,
  "logs": [
    {
      "id": "log-uuid-1",
      "timestamp": "2025-12-03T10:00:00Z",
      "action": "updated",
      "category": "data_mutation",
      "severity": "info",
      "actor": {
        "id": "user-uuid",
        "email": "broker@company.com",
        "type": "user"
      },
      "changes": {
        "before": { "phone": "+971501111111" },
        "after": { "phone": "+971502222222" },
        "changedFields": ["phone"]
      },
      "context": {
        "ipAddress": "203.0.113.42",
        "userAgent": "Mozilla/5.0...",
        "requestId": "req-uuid"
      }
    }
  ],
  "continuationToken": "token-for-next-page"
}
```

---

#### `GET /api/audit/user/{userId}`

Get all actions performed by a specific user.

**Request**:
```http
GET /api/audit/user/user-uuid?startDate=2025-12-01&endDate=2025-12-03
Cookie: nectaria_access_token=eyJ...
```

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | No | ISO 8601 date |
| `endDate` | string | No | ISO 8601 date |
| `action` | string | No | Filter by action type |
| `limit` | number | No | Max results (default: 50) |
| `continuationToken` | string | No | Pagination token |

**Response**:
```json
HTTP/1.1 200 OK

{
  "userId": "user-uuid",
  "email": "broker@company.com",
  "totalCount": 127,
  "logs": [
    {
      "id": "log-uuid",
      "timestamp": "2025-12-03T10:00:00Z",
      "entityType": "customer",
      "entityId": "cust-uuid",
      "action": "created",
      "category": "data_mutation",
      "severity": "info"
    }
  ],
  "continuationToken": "token-for-next-page"
}
```

---

#### `POST /api/audit/search`

Search audit logs with multiple filters.

**Request**:
```json
POST /api/audit/search
Content-Type: application/json
Cookie: nectaria_access_token=eyJ...

{
  "startDate": "2025-12-01T00:00:00Z",
  "endDate": "2025-12-03T23:59:59Z",
  "filters": {
    "entityType": "customer",
    "action": "updated",
    "actorId": "user-uuid",
    "category": "data_mutation",
    "severity": "info"
  },
  "limit": 50,
  "continuationToken": null
}
```

**Response**:
```json
HTTP/1.1 200 OK

{
  "totalCount": 45,
  "logs": [...],
  "filters": {
    "startDate": "2025-12-01T00:00:00Z",
    "endDate": "2025-12-03T23:59:59Z",
    "entityType": "customer",
    "action": "updated"
  },
  "continuationToken": "token-for-next-page"
}
```

---

#### `POST /api/audit/export`

Export audit logs to PDF or CSV.

**Request**:
```json
POST /api/audit/export
Content-Type: application/json
Cookie: nectaria_access_token=eyJ...

{
  "format": "pdf",
  "startDate": "2025-12-01T00:00:00Z",
  "endDate": "2025-12-03T23:59:59Z",
  "filters": {
    "entityType": "customer",
    "category": "data_mutation"
  },
  "includeDetails": true
}
```

**Response**:
```json
HTTP/1.1 202 Accepted

{
  "exportId": "export-uuid",
  "status": "processing",
  "estimatedRecords": 1500,
  "checkStatusUrl": "/api/audit/export/export-uuid"
}
```

---

#### `GET /api/audit/export/{exportId}`

Check export status and get download URL.

**Response (Processing)**:
```json
HTTP/1.1 200 OK

{
  "exportId": "export-uuid",
  "status": "processing",
  "progress": 65
}
```

**Response (Complete)**:
```json
HTTP/1.1 200 OK

{
  "exportId": "export-uuid",
  "status": "complete",
  "format": "pdf",
  "recordCount": 1500,
  "fileSize": 256000,
  "downloadUrl": "https://storage.blob.core.windows.net/exports/...",
  "expiresAt": "2025-12-03T11:00:00Z"
}
```

---

#### `GET /api/audit/stats`

Get audit statistics.

**Request**:
```http
GET /api/audit/stats?period=week
Cookie: nectaria_access_token=eyJ...
```

**Response**:
```json
HTTP/1.1 200 OK

{
  "period": "week",
  "startDate": "2025-11-27",
  "endDate": "2025-12-03",
  "totals": {
    "totalEvents": 15420,
    "byCategory": {
      "authentication": 3200,
      "data_mutation": 8500,
      "data_access": 2100,
      "security_event": 120,
      "authorization": 1500
    },
    "byAction": {
      "created": 2500,
      "updated": 5800,
      "deleted": 200,
      "login": 3000,
      "logout": 2800,
      "permission_denied": 120
    },
    "bySeverity": {
      "info": 15000,
      "warning": 300,
      "critical": 120
    }
  },
  "topActors": [
    { "userId": "user-1", "email": "broker1@company.com", "count": 1250 },
    { "userId": "user-2", "email": "broker2@company.com", "count": 980 }
  ],
  "securityEvents": {
    "failedLogins": 45,
    "permissionDenied": 120,
    "suspiciousActivity": 5
  }
}
```

---

### 3.2 Internal Endpoints

#### `POST /api/audit/log` (Internal)

Create an audit log entry directly (used by services that can't publish events).

**Request**:
```json
POST /api/audit/log
Content-Type: application/json
X-Service-Key: {internal-service-key}

{
  "entityType": "customer",
  "entityId": "cust-uuid",
  "action": "viewed",
  "category": "data_access",
  "severity": "info",
  "actor": {
    "id": "user-uuid",
    "email": "broker@company.com",
    "type": "user"
  },
  "context": {
    "ipAddress": "203.0.113.42",
    "userAgent": "Mozilla/5.0...",
    "requestId": "req-uuid",
    "serviceName": "customer-service"
  },
  "metadata": {
    "fieldsAccessed": ["phone", "email", "address"]
  }
}
```

**Response**:
```json
HTTP/1.1 201 Created

{
  "id": "log-uuid",
  "timestamp": "2025-12-03T10:00:00Z"
}
```

---

## 4. Database Schema

**Database**: `audit-db`

### Container: `audit-logs`

**Partition Key**: `/entityType`

```typescript
interface AuditLog {
  id: string;                    // UUID
  entityType: string;            // Partition key: 'auth', 'customer', 'staff', etc.
  entityId: string;              // ID of the affected entity
  
  // Action
  action: string;                // 'created', 'updated', 'deleted', 'login', etc.
  category: AuditCategory;
  severity: 'info' | 'warning' | 'critical';
  
  // Actor
  actor: {
    id: string;                  // User ID or 'system'
    email: string;
    name?: string;
    roles?: string[];
    type: 'user' | 'system' | 'service';
  };
  
  // Changes (for mutations)
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
    changedFields?: string[];
  };
  
  // Context
  context: {
    ipAddress: string;
    userAgent: string;
    requestId: string;
    serviceName: string;
    correlationId?: string;
  };
  
  // Metadata
  metadata?: Record<string, any>;
  
  // Timestamps
  timestamp: string;             // ISO 8601
  _ts: number;                   // Cosmos DB timestamp
  
  // NO TTL - retained indefinitely
}

type AuditCategory = 
  | 'authentication'     // Login, logout, token refresh
  | 'authorization'      // Permission checks, role changes
  | 'data_mutation'      // CRUD operations
  | 'data_access'        // Read operations on sensitive data
  | 'security_event'     // Failed logins, unauthorized access
  | 'compliance'         // AML checks, underwriting decisions
  | 'system'             // Configuration changes, deployments
  | 'financial';         // Payments, refunds
```

**Indexes**:
- Composite: `[entityType ASC, timestamp DESC]` - Query by entity type
- Composite: `[entityType ASC, entityId ASC, timestamp DESC]` - Query by specific entity
- Single: `actor.id` - Query by user

---

### Container: `audit-summaries`

**Partition Key**: `/date`

```typescript
interface AuditSummary {
  id: string;                    // UUID
  date: string;                  // Partition key: '2025-12-03'
  
  totals: {
    totalEvents: number;
    byCategory: Record<string, number>;
    byAction: Record<string, number>;
    bySeverity: Record<string, number>;
    byEntityType: Record<string, number>;
  };
  
  topActors: Array<{
    userId: string;
    email: string;
    count: number;
  }>;
  
  securityEvents: {
    failedLogins: number;
    permissionDenied: number;
    suspiciousActivity: number;
  };
  
  generatedAt: string;
  ttl: number;                   // 365 days
}
```

---

### Container: `exports`

**Partition Key**: `/exportId`

```typescript
interface AuditExport {
  id: string;
  exportId: string;              // Partition key
  status: 'pending' | 'processing' | 'complete' | 'failed';
  
  request: {
    format: 'pdf' | 'csv';
    startDate: string;
    endDate: string;
    filters: Record<string, any>;
    requestedBy: string;
  };
  
  result?: {
    recordCount: number;
    fileSize: number;
    blobUrl: string;
    expiresAt: string;
  };
  
  error?: {
    code: string;
    message: string;
  };
  
  progress: number;              // 0-100
  createdAt: string;
  completedAt?: string;
  ttl: number;                   // 24 hours
}
```

---

## 5. Events

### Events Consumed

The Audit Service subscribes to **all** domain events. Here are the key event patterns:

| Event Pattern | Source Service | Category |
|---------------|----------------|----------|
| `auth.user.logged_in` | Authentication Service | authentication |
| `auth.user.logged_out` | Authentication Service | authentication |
| `auth.login.failed` | Authentication Service | security_event |
| `auth.session.*` | Authentication Service | authentication |
| `customer.created` | Customer Service | data_mutation |
| `customer.updated` | Customer Service | data_mutation |
| `customer.deleted` | Customer Service | data_mutation |
| `staff.created` | Staff Management Service | data_mutation |
| `staff.updated` | Staff Management Service | data_mutation |
| `staff.deactivated` | Staff Management Service | data_mutation |
| `role.assigned` | Authorization Service | authorization |
| `role.removed` | Authorization Service | authorization |
| `role.created` | Authorization Service | authorization |
| `permission.denied` | Authorization Service | security_event |
| `document.uploaded` | Document Service | data_mutation |
| `document.downloaded` | Document Service | data_access |
| `document.deleted` | Document Service | data_mutation |
| `policy.issued` | Policy Service | data_mutation |
| `policy.renewed` | Policy Service | data_mutation |
| `quote.created` | Quote Service | data_mutation |
| `quote.approved` | Quote Service | data_mutation |
| `form.submitted` | Form Service | data_mutation |
| `workflow.*` | Workflow Service | system |

### Event Handler Logic

```typescript
// Pseudocode for event handling
async function handleEvent(event: EventGridEvent): Promise<void> {
  const auditLog: AuditLog = {
    id: generateUUID(),
    entityType: extractEntityType(event.eventType),
    entityId: extractEntityId(event.subject),
    action: extractAction(event.eventType),
    category: mapToCategory(event.eventType),
    severity: determineSeverity(event),
    actor: extractActor(event.data),
    changes: extractChanges(event.data),
    context: {
      ipAddress: event.data.ipAddress || 'unknown',
      userAgent: event.data.userAgent || 'unknown',
      requestId: event.data.requestId || event.id,
      serviceName: extractServiceName(event.source),
    },
    metadata: event.data.metadata,
    timestamp: event.eventTime,
  };
  
  // Sanitize PII
  auditLog.changes = sanitizePII(auditLog.changes);
  
  // Store in Cosmos DB
  await auditRepository.create(auditLog);
}
```

---

## 6. Configuration

```typescript
interface AuditConfig {
  // Cosmos DB
  cosmosDb: {
    endpoint: string;
    databaseName: string;        // 'audit-db'
    containers: {
      logs: string;              // 'audit-logs'
      summaries: string;         // 'audit-summaries'
      exports: string;           // 'exports'
    };
  };
  
  // Event Grid
  eventGrid: {
    topicEndpoint: string;
    subscriptionName: string;
    filterPattern: string;       // '*.*' for all events
  };
  
  // Export
  export: {
    blobContainer: string;       // 'audit-exports'
    maxRecords: number;          // 100000
    urlExpiryHours: number;      // 1
    formats: string[];           // ['pdf', 'csv']
  };
  
  // Retention
  retention: {
    logs: null;                  // No TTL - keep forever
    summaries: number;           // 365 days
    exports: number;             // 1 day
  };
  
  // PII Sanitization
  pii: {
    fieldsToMask: string[];      // ['ssn', 'passport', 'creditCard']
    fieldsToHash: string[];      // ['email', 'phone']
    maskPattern: string;         // '***MASKED***'
  };
  
  // Query Limits
  query: {
    defaultLimit: number;        // 50
    maxLimit: number;            // 100
    maxDateRangeDays: number;    // 90
  };
}
```

---

## 7. Security

### 7.1 Access Control

| Endpoint | Required Permission |
|----------|---------------------|
| `GET /api/audit/entity/*` | `audit:read` |
| `GET /api/audit/user/*` | `audit:read` |
| `POST /api/audit/search` | `audit:read` |
| `POST /api/audit/export` | `audit:export` |
| `GET /api/audit/stats` | `audit:read` |
| `POST /api/audit/log` | Internal service key |

### 7.2 Data Security

| Aspect | Implementation |
|--------|----------------|
| Immutability | No UPDATE or DELETE operations allowed |
| PII Protection | Sensitive fields masked or hashed |
| Encryption at Rest | Cosmos DB encryption enabled |
| Encryption in Transit | HTTPS only |
| Access Logging | Audit access to audit logs (meta-audit) |

### 7.3 PII Sanitization

```typescript
const piiConfig = {
  // Fields to completely mask
  mask: [
    'ssn', 'socialSecurityNumber',
    'passport', 'passportNumber',
    'creditCard', 'cardNumber',
    'bankAccount', 'accountNumber',
    'password', 'secret', 'token',
  ],
  
  // Fields to partially mask (show last 4)
  partialMask: [
    'phone', 'phoneNumber', 'mobile',
    'emiratesId',
  ],
  
  // Fields to hash (for searchability)
  hash: [
    'email',
  ],
};

function sanitizePII(data: any): any {
  // Implementation masks/hashes PII fields
}
```

---

## 8. Test Cases

```typescript
// File: src/tests/audit.test.ts

import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';

describe('AuditService', () => {
  
  describe('Event Handling', () => {
    it('should store UserLoggedInEvent as audit log', async () => {
      const event = createMockEvent('auth.user.logged_in', {
        userId: 'user-uuid',
        email: 'user@example.com',
        ipAddress: '203.0.113.42',
      });
      
      await handleEvent(event, mockContext);
      
      const log = await auditRepository.findById(event.id);
      assert.ok(log);
      assert.strictEqual(log.entityType, 'auth');
      assert.strictEqual(log.action, 'logged_in');
      assert.strictEqual(log.category, 'authentication');
    });

    it('should extract before/after state for update events', async () => {
      const event = createMockEvent('customer.updated', {
        customerId: 'cust-uuid',
        before: { phone: '+971501111111' },
        after: { phone: '+971502222222' },
      });
      
      await handleEvent(event, mockContext);
      
      const log = await auditRepository.findByEntityId('customer', 'cust-uuid');
      assert.deepStrictEqual(log.changes.changedFields, ['phone']);
    });

    it('should sanitize PII before storage', async () => {
      const event = createMockEvent('customer.created', {
        customerId: 'cust-uuid',
        data: {
          email: 'customer@example.com',
          ssn: '123-45-6789',
          phone: '+971501234567',
        },
      });
      
      await handleEvent(event, mockContext);
      
      const log = await auditRepository.findByEntityId('customer', 'cust-uuid');
      assert.strictEqual(log.changes.after.ssn, '***MASKED***');
      assert.ok(log.changes.after.phone.includes('****'));
    });

    it('should handle high-volume events without loss', async () => {
      const events = Array.from({ length: 1000 }, (_, i) => 
        createMockEvent('customer.updated', { id: `event-${i}` })
      );
      
      await Promise.all(events.map(e => handleEvent(e, mockContext)));
      
      const count = await auditRepository.countByDateRange(today, today);
      assert.strictEqual(count, 1000);
    });

    it('should categorize events correctly', async () => {
      const testCases = [
        { eventType: 'auth.user.logged_in', expectedCategory: 'authentication' },
        { eventType: 'auth.login.failed', expectedCategory: 'security_event' },
        { eventType: 'customer.created', expectedCategory: 'data_mutation' },
        { eventType: 'document.downloaded', expectedCategory: 'data_access' },
        { eventType: 'role.assigned', expectedCategory: 'authorization' },
      ];
      
      for (const tc of testCases) {
        const event = createMockEvent(tc.eventType, {});
        await handleEvent(event, mockContext);
        const log = await auditRepository.findById(event.id);
        assert.strictEqual(log.category, tc.expectedCategory);
      }
    });

    it('should set severity based on event type', async () => {
      const failedLogin = createMockEvent('auth.login.failed', { attempts: 5 });
      await handleEvent(failedLogin, mockContext);
      
      const log = await auditRepository.findById(failedLogin.id);
      assert.strictEqual(log.severity, 'warning');
    });
  });

  describe('Query by Entity', () => {
    it('should return logs for specific entity', async () => {
      const response = await getAuditByEntity(
        createMockRequest({ params: { entityType: 'customer', entityId: 'cust-uuid' } }),
        mockContext
      );
      
      const body = await response.json();
      assert.ok(Array.isArray(body.logs));
      body.logs.forEach((log: any) => {
        assert.strictEqual(log.entityId, 'cust-uuid');
      });
    });

    it('should order results by timestamp descending', async () => {
      const response = await getAuditByEntity(validRequest, mockContext);
      const body = await response.json();
      
      for (let i = 1; i < body.logs.length; i++) {
        assert.ok(body.logs[i-1].timestamp >= body.logs[i].timestamp);
      }
    });

    it('should support pagination', async () => {
      const response1 = await getAuditByEntity(
        createMockRequest({ query: { limit: 10 } }),
        mockContext
      );
      const body1 = await response1.json();
      
      assert.ok(body1.continuationToken);
      assert.strictEqual(body1.logs.length, 10);
      
      const response2 = await getAuditByEntity(
        createMockRequest({ query: { limit: 10, continuationToken: body1.continuationToken } }),
        mockContext
      );
      const body2 = await response2.json();
      
      // Should be different logs
      assert.notStrictEqual(body1.logs[0].id, body2.logs[0].id);
    });
  });

  describe('Query by User', () => {
    it('should return all actions by a specific user', async () => {
      const response = await getAuditByUser(
        createMockRequest({ params: { userId: 'user-uuid' } }),
        mockContext
      );
      
      const body = await response.json();
      body.logs.forEach((log: any) => {
        assert.strictEqual(log.actor.id, 'user-uuid');
      });
    });

    it('should filter by date range', async () => {
      const response = await getAuditByUser(
        createMockRequest({
          params: { userId: 'user-uuid' },
          query: { startDate: '2025-12-01', endDate: '2025-12-02' },
        }),
        mockContext
      );
      
      const body = await response.json();
      body.logs.forEach((log: any) => {
        const ts = new Date(log.timestamp);
        assert.ok(ts >= new Date('2025-12-01'));
        assert.ok(ts <= new Date('2025-12-03'));
      });
    });
  });

  describe('Search', () => {
    it('should filter by multiple criteria', async () => {
      const response = await searchAudit(
        createMockRequest({
          body: {
            startDate: '2025-12-01',
            endDate: '2025-12-03',
            filters: {
              entityType: 'customer',
              action: 'updated',
              category: 'data_mutation',
            },
          },
        }),
        mockContext
      );
      
      const body = await response.json();
      body.logs.forEach((log: any) => {
        assert.strictEqual(log.entityType, 'customer');
        assert.strictEqual(log.action, 'updated');
        assert.strictEqual(log.category, 'data_mutation');
      });
    });

    it('should require date range', async () => {
      const response = await searchAudit(
        createMockRequest({ body: { filters: { entityType: 'customer' } } }),
        mockContext
      );
      
      assert.strictEqual(response.status, 400);
    });

    it('should limit date range to 90 days', async () => {
      const response = await searchAudit(
        createMockRequest({
          body: {
            startDate: '2025-01-01',
            endDate: '2025-12-31',
            filters: {},
          },
        }),
        mockContext
      );
      
      assert.strictEqual(response.status, 400);
    });
  });

  describe('Export', () => {
    it('should create export job', async () => {
      const response = await createExport(
        createMockRequest({
          body: {
            format: 'csv',
            startDate: '2025-12-01',
            endDate: '2025-12-03',
            filters: {},
          },
        }),
        mockContext
      );
      
      assert.strictEqual(response.status, 202);
      const body = await response.json();
      assert.ok(body.exportId);
      assert.strictEqual(body.status, 'processing');
    });

    it('should return download URL when complete', async () => {
      // Create and wait for export
      const createResponse = await createExport(validExportRequest, mockContext);
      const { exportId } = await createResponse.json();
      
      // Poll for completion
      await waitForExportComplete(exportId);
      
      const statusResponse = await getExportStatus(
        createMockRequest({ params: { exportId } }),
        mockContext
      );
      const body = await statusResponse.json();
      
      assert.strictEqual(body.status, 'complete');
      assert.ok(body.downloadUrl);
    });

    it('should limit export to 100,000 records', async () => {
      // Test with large dataset
      const response = await createExport(largeExportRequest, mockContext);
      const body = await response.json();
      
      // Should succeed but cap records
      assert.strictEqual(response.status, 202);
    });
  });

  describe('Statistics', () => {
    it('should return correct totals', async () => {
      const response = await getStats(
        createMockRequest({ query: { period: 'day' } }),
        mockContext
      );
      
      const body = await response.json();
      assert.ok(body.totals.totalEvents >= 0);
      assert.ok(body.totals.byCategory);
      assert.ok(body.totals.byAction);
    });

    it('should return top actors', async () => {
      const response = await getStats(validRequest, mockContext);
      const body = await response.json();
      
      assert.ok(Array.isArray(body.topActors));
      assert.ok(body.topActors.length <= 10);
    });
  });

  describe('Security', () => {
    it('should require audit:read permission', async () => {
      const response = await getAuditByEntity(
        createMockRequest({ user: { permissions: [] } }),
        mockContext
      );
      
      assert.strictEqual(response.status, 403);
    });

    it('should require audit:export permission for exports', async () => {
      const response = await createExport(
        createMockRequest({ user: { permissions: ['audit:read'] } }),
        mockContext
      );
      
      assert.strictEqual(response.status, 403);
    });

    it('should not allow updates to audit logs', async () => {
      // Verify no update method exists
      assert.strictEqual(typeof auditRepository.update, 'undefined');
    });

    it('should not allow deletes from audit logs', async () => {
      // Verify no delete method exists
      assert.strictEqual(typeof auditRepository.delete, 'undefined');
    });

    it('should log access to audit logs (meta-audit)', async () => {
      await getAuditByEntity(validRequest, mockContext);
      
      // Check that the access itself was logged
      const accessLog = await auditRepository.findByAction('audit_accessed');
      assert.ok(accessLog);
    });
  });
});
```

---

## 9. File Structure

```
audit-service/
├── src/
│   ├── functions/
│   │   ├── events/
│   │   │   ├── AuthEventHandler.ts      # Handle auth.* events
│   │   │   ├── CustomerEventHandler.ts  # Handle customer.* events
│   │   │   ├── StaffEventHandler.ts     # Handle staff.* events
│   │   │   ├── PolicyEventHandler.ts    # Handle policy.* events
│   │   │   ├── DocumentEventHandler.ts  # Handle document.* events
│   │   │   ├── RoleEventHandler.ts      # Handle role.* events
│   │   │   └── GenericEventHandler.ts   # Handle all other events
│   │   ├── GetAuditByEntity.ts
│   │   ├── GetAuditByUser.ts
│   │   ├── SearchAudit.ts
│   │   ├── CreateExport.ts
│   │   ├── GetExportStatus.ts
│   │   ├── GetStats.ts
│   │   ├── CreateAuditLog.ts            # Internal endpoint
│   │   └── GenerateDailySummary.ts      # Timer trigger
│   ├── lib/
│   │   ├── auditRepository.ts
│   │   ├── summaryRepository.ts
│   │   ├── exportRepository.ts
│   │   ├── eventMapper.ts               # Map events to audit logs
│   │   ├── piiSanitizer.ts              # Sanitize PII
│   │   ├── diffCalculator.ts            # Calculate before/after diff
│   │   ├── exportService.ts             # Generate PDF/CSV
│   │   ├── blobService.ts               # Upload to Blob Storage
│   │   ├── config.ts
│   │   └── cosmosClient.ts
│   ├── models/
│   │   ├── AuditLog.ts
│   │   ├── AuditSummary.ts
│   │   └── AuditExport.ts
│   └── tests/
│       ├── eventHandlers.test.ts
│       ├── auditRepository.test.ts
│       ├── queryEndpoints.test.ts
│       ├── exportService.test.ts
│       └── piiSanitizer.test.ts
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
    "@azure/storage-blob": "^12.0.0",
    "@azure/event-grid": "^5.0.0",
    "pdfkit": "^0.14.0",
    "json2csv": "^6.0.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/pdfkit": "^0.13.0",
    "typescript": "^5.0.0",
    "azure-functions-core-tools": "^4.0.0"
  }
}
```

### Azure Resources

| Resource | Purpose |
|----------|---------|
| Azure Cosmos DB | Store audit logs |
| Azure Event Grid | Subscribe to events |
| Azure Blob Storage | Store export files |
| Azure Functions | Compute |

---

**Document Version**: 1.0  
**Created**: December 3, 2025  
**Status**: APPROVED

