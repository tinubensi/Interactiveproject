# Workflow Service Requirements

## Overview

The Workflow Service is a configuration-driven orchestration engine that enables administrators to define, manage, and execute business workflows without code changes. It provides a visual workflow designer experience backed by a powerful execution engine.

### Service Identity

| Property | Value |
|----------|-------|
| **Service Name** | `workflow-service` |
| **Runtime** | Azure Functions (Node.js 20, TypeScript) |
| **Database** | Azure Cosmos DB (`workflow-db`) |
| **Event Bus** | Azure Event Grid (Publisher & Subscriber) |
| **Dependencies** | Authentication, Authorization, Audit, Staff Management |
| **Status** | Implemented (Phase 1) |

---

## Table of Contents

1. [Architecture](#1-architecture)
2. [Functional Requirements](#2-functional-requirements)
3. [API Reference](#3-api-reference)
4. [Database Schema](#4-database-schema)
5. [Event Catalog](#5-event-catalog)
6. [Security Integration](#6-security-integration)
7. [Service Integrations](#7-service-integrations)
8. [Gaps & Enhancements](#8-gaps--enhancements)
9. [Test Coverage](#9-test-coverage)
10. [Deployment](#10-deployment)

---

## 1. Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WORKFLOW SERVICE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Admin APIs  │  │Instance APIs│  │Approval APIs│  │Analytics API│        │
│  │  (CRUD)     │  │  (Manage)   │  │ (Decide)    │  │  (Metrics)  │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
│  ┌──────┴────────────────┴────────────────┴────────────────┴──────┐        │
│  │                    WORKFLOW ENGINE                              │        │
│  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐      │        │
│  │  │ Expression     │ │ Condition      │ │ Step Executor  │      │        │
│  │  │ Resolver       │ │ Evaluator      │ │ Dispatcher     │      │        │
│  │  └────────────────┘ └────────────────┘ └────────────────┘      │        │
│  └─────────────────────────────┬──────────────────────────────────┘        │
│                                │                                            │
│  ┌─────────────────────────────┴──────────────────────────────────┐        │
│  │                      STEP EXECUTORS                             │        │
│  │  ┌─────┐ ┌───────┐ ┌──────┐ ┌─────────┐ ┌──────┐ ┌──────────┐  │        │
│  │  │HTTP │ │ Event │ │Cosmos│ │Transform│ │Script│ │ Human    │  │        │
│  │  └─────┘ └───────┘ └──────┘ └─────────┘ └──────┘ └──────────┘  │        │
│  └─────────────────────────────────────────────────────────────────┘        │
├─────────────────────────────────────────────────────────────────────────────┤
│                         SECURITY LAYER                                       │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────────────┐ │
│  │ Authentication      │  │ Authorization       │  │ Audit Logging        │ │
│  │ Service             │  │ Service             │  │ Service              │ │
│  │ (Token Validation)  │  │ (Permission Check)  │  │ (Event Consumption)  │ │
│  └─────────────────────┘  └─────────────────────┘  └──────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│                           DATA LAYER                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────┐ ┌────────────┐ ┌─────────┐ │
│  │  Definitions │ │  Instances   │ │ Triggers │ │  Approvals │ │Templates│ │
│  │  Container   │ │  Container   │ │Container │ │  Container │ │Container│ │
│  └──────────────┘ └──────────────┘ └──────────┘ └────────────┘ └─────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EVENT GRID                                         │
│  Publishes: WorkflowInstanceStarted, WorkflowInstanceCompleted,              │
│             WorkflowApprovalRequired, WorkflowStepCompleted                  │
│  Subscribes: IntakeFormSubmittedEvent, PolicyNearingExpiryEvent,            │
│              CustomerCreatedEvent, LeadStageChangedEvent                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step Types

| Type | Description | Execution Mode |
|------|-------------|----------------|
| `action` | Execute HTTP, event, Cosmos operations | Immediate |
| `decision` | Branch based on conditions | Immediate |
| `transform` | Transform data using JSONata | Immediate |
| `script` | Execute JavaScript in sandbox | Immediate |
| `setVariable` | Set workflow variables | Immediate |
| `delay` | Wait for duration | Timer |
| `wait` | Wait for event or condition | External |
| `human` | Request human approval | External |
| `parallel` | Execute branches simultaneously | Orchestrated |
| `loop` | Iterate over collection | Orchestrated |
| `subworkflow` | Call another workflow | Orchestrated |
| `terminate` | End workflow execution | Immediate |

### Trigger Types

| Type | Description | Configuration |
|------|-------------|---------------|
| `event` | Triggered by Event Grid event | `eventType`, `eventFilter` |
| `http` | Triggered by HTTP request | `method`, `route`, `authRequired` |
| `schedule` | Triggered by CRON schedule | `cronExpression`, `timezone` |
| `manual` | Triggered manually via API | `requiredInputs` |

---

## 2. Functional Requirements

### 2.1 Workflow Management

#### FR-WF-001: Create Workflow

**Priority**: P1 (Must Have)

```
As a workflow administrator,
I want to create a new workflow definition,
So that I can automate business processes.
```

**Acceptance Criteria**:
- [x] Create workflow with name, description, organization
- [x] Define triggers (event, HTTP, schedule, manual)
- [x] Define steps with execution logic
- [x] Define variables and settings
- [x] Workflow starts in `draft` status
- [x] Validate workflow structure on creation
- [x] Publish WorkflowCreatedEvent

#### FR-WF-002: Workflow Versioning

**Priority**: P1 (Must Have)

```
As a workflow administrator,
I want workflows to be versioned,
So that I can track changes and rollback if needed.
```

**Acceptance Criteria**:
- [x] Auto-increment version on each update
- [x] Running instances use their original version
- [x] New instances use latest active version
- [x] Access specific version via API
- [x] View version history

#### FR-WF-003: Workflow Activation

**Priority**: P1 (Must Have)

```
As a workflow administrator,
I want to activate/deactivate workflows,
So that I can control when they can be executed.
```

**Acceptance Criteria**:
- [x] Activate workflow (draft → active)
- [x] Deactivate workflow (active → inactive)
- [x] Deprecate workflow (active → deprecated)
- [x] Validate workflow before activation
- [x] Running instances continue when deactivated
- [x] New instances blocked for inactive workflows

### 2.2 Workflow Execution

#### FR-WF-004: Start Workflow Instance

**Priority**: P1 (Must Have)

```
As a system or user,
I want to start a workflow instance,
So that a business process is executed.
```

**Acceptance Criteria**:
- [x] Start from event trigger
- [x] Start from HTTP trigger
- [x] Start from schedule trigger
- [x] Start manually via API
- [x] Validate input against schema
- [x] Generate unique instance ID
- [x] Initialize variables from trigger data
- [x] Publish WorkflowInstanceStartedEvent

#### FR-WF-005: Execute Steps

**Priority**: P1 (Must Have)

```
As the workflow engine,
I want to execute steps in sequence,
So that the workflow logic is performed.
```

**Acceptance Criteria**:
- [x] Execute action steps (HTTP, event, Cosmos)
- [x] Evaluate decision conditions
- [x] Transform data using JSONata
- [x] Execute scripts in sandbox
- [x] Handle parallel branches
- [x] Handle loops over collections
- [x] Track step execution status
- [x] Publish WorkflowStepCompletedEvent

#### FR-WF-006: Error Handling

**Priority**: P1 (Must Have)

```
As a workflow administrator,
I want workflows to handle errors gracefully,
So that failures don't cause data inconsistency.
```

**Acceptance Criteria**:
- [x] Retry with configurable policy
- [x] Skip step and continue
- [x] Fail workflow
- [x] Goto fallback step
- [x] Execute compensation logic
- [x] Log errors with context
- [x] Publish WorkflowInstanceFailedEvent

### 2.3 Human Approvals

#### FR-WF-007: Create Approval Request

**Priority**: P1 (Must Have)

```
As the workflow engine,
I want to create approval requests,
So that humans can make decisions in the workflow.
```

**Acceptance Criteria**:
- [x] Create approval with context data
- [x] Specify approver roles or users
- [x] Set required approval count
- [x] Set expiration time
- [x] Pause workflow execution
- [x] Publish WorkflowApprovalRequiredEvent

#### FR-WF-008: Submit Approval Decision

**Priority**: P1 (Must Have)

```
As an approver,
I want to approve or reject requests,
So that workflows can continue.
```

**Acceptance Criteria**:
- [x] Approve with optional comment/data
- [x] Reject with optional comment/data
- [x] Validate approver authorization
- [x] Track all decisions
- [x] Resume workflow on approval
- [x] Route workflow on rejection
- [x] Publish WorkflowApprovalCompletedEvent

#### FR-WF-009: Approval Escalation

**Priority**: P2 (Should Have)

```
As a workflow administrator,
I want approvals to escalate,
So that workflows don't get stuck.
```

**Acceptance Criteria**:
- [x] Configure escalation timeout
- [x] Configure escalation recipients
- [ ] Auto-escalate after timeout (needs enhancement)
- [ ] Notify escalation recipients (needs Notification Service)
- [x] Track escalation history

### 2.4 Observability

#### FR-WF-010: Workflow Analytics

**Priority**: P2 (Should Have)

```
As a manager,
I want to view workflow analytics,
So that I can understand performance.
```

**Acceptance Criteria**:
- [x] Total executions by period
- [x] Success/failure rates
- [x] Average duration
- [x] Step-level metrics
- [x] Bottleneck identification
- [x] Top performing workflows

---

## 3. API Reference

### Workflow Management APIs

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `POST` | `/api/workflows` | Create workflow | `workflows:create` |
| `GET` | `/api/workflows` | List workflows | `workflows:read` |
| `GET` | `/api/workflows/{id}` | Get workflow | `workflows:read` |
| `PUT` | `/api/workflows/{id}` | Update workflow | `workflows:update` |
| `DELETE` | `/api/workflows/{id}` | Delete workflow | `workflows:delete` |
| `POST` | `/api/workflows/{id}/activate` | Activate | `workflows:manage` |
| `POST` | `/api/workflows/{id}/deactivate` | Deactivate | `workflows:manage` |
| `POST` | `/api/workflows/{id}/clone` | Clone | `workflows:create` |
| `GET` | `/api/workflows/{id}/versions` | Get versions | `workflows:read` |
| `POST` | `/api/workflows/{id}/validate` | Validate | `workflows:read` |

### Step Management APIs

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `POST` | `/api/workflows/{id}/steps` | Add step | `workflows:update` |
| `PUT` | `/api/workflows/{id}/steps/{stepId}` | Update step | `workflows:update` |
| `DELETE` | `/api/workflows/{id}/steps/{stepId}` | Delete step | `workflows:update` |
| `PUT` | `/api/workflows/{id}/steps/reorder` | Reorder | `workflows:update` |

### Instance APIs

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `POST` | `/api/workflows/{id}/start` | Start instance | `workflows:execute` |
| `GET` | `/api/instances` | List instances | `instances:read` |
| `GET` | `/api/instances/{id}` | Get instance | `instances:read` |
| `POST` | `/api/instances/{id}/cancel` | Cancel | `instances:cancel` |
| `GET` | `/api/instances/{id}/logs` | Get logs | `instances:read` |

### Approval APIs

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/api/approvals/pending` | List pending | `approvals:read` |
| `GET` | `/api/approvals/{id}` | Get approval | `approvals:read` |
| `POST` | `/api/approvals/{id}/decide` | Submit decision | `approvals:decide` |
| `POST` | `/api/approvals/{id}/reassign` | Reassign | `approvals:reassign` |

### Template APIs

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `POST` | `/api/templates` | Create template | `templates:create` |
| `GET` | `/api/templates` | List templates | `templates:read` |
| `GET` | `/api/templates/{id}` | Get template | `templates:read` |
| `PUT` | `/api/templates/{id}` | Update template | `templates:update` |
| `DELETE` | `/api/templates/{id}` | Delete template | `templates:delete` |
| `POST` | `/api/templates/{id}/create-workflow` | Create from template | `workflows:create` |

### Analytics APIs

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/api/analytics/overview` | Get overview | `analytics:read` |
| `GET` | `/api/analytics/workflows/{id}` | Get workflow analytics | `analytics:read` |

---

## 4. Database Schema

**Database**: `workflow-db`

### Container: `workflow-definitions`
**Partition Key**: `/workflowId`

```typescript
interface WorkflowDefinition {
  id: string;                    // Compound: workflowId_version
  workflowId: string;            // Partition key
  name: string;
  description?: string;
  version: number;
  status: 'draft' | 'active' | 'inactive' | 'deprecated';
  organizationId: string;
  
  // Configuration
  triggers: TriggerDefinition[];
  steps: WorkflowStep[];
  variables?: Record<string, VariableDefinition>;
  settings?: WorkflowSettings;
  
  // Metadata
  tags?: string[];
  category?: string;
  
  // Audit
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
  activatedAt?: string;
  activatedBy?: string;
  
  // Soft delete
  isDeleted?: boolean;
}
```

### Container: `workflow-instances`
**Partition Key**: `/workflowId`

```typescript
interface WorkflowInstance {
  id: string;
  instanceId: string;
  workflowId: string;            // Partition key
  workflowVersion: number;
  workflowName: string;
  organizationId: string;
  
  // Trigger context
  triggerId: string;
  triggerType: TriggerType;
  triggerData?: Record<string, unknown>;
  
  // Execution state
  status: InstanceStatus;
  currentStepId?: string;
  stepExecutions: StepExecution[];
  variables: Record<string, unknown>;
  completedStepIds: string[];
  
  // Correlation
  correlationId?: string;
  parentInstanceId?: string;
  
  // Timing
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  
  // Error
  lastError?: ExecutionError;
  
  // Actor
  initiatedBy?: string;
  
  // TTL for cleanup
  ttl?: number;
}
```

### Container: `workflow-triggers`
**Partition Key**: `/eventType`

```typescript
interface WorkflowTrigger {
  id: string;
  triggerId: string;
  eventType: string;             // Partition key
  workflowId: string;
  workflowVersion?: number;
  organizationId: string;
  isActive: boolean;
  eventFilter?: string;
  priority?: number;
  createdAt: string;
}
```

### Container: `workflow-approvals`
**Partition Key**: `/organizationId`

```typescript
interface ApprovalRequest {
  id: string;
  approvalId: string;
  instanceId: string;
  workflowId: string;
  stepId: string;
  stepName: string;
  organizationId: string;        // Partition key
  
  // Configuration
  approverRoles?: string[];
  approverUsers?: string[];
  requiredApprovals: number;
  currentApprovals: number;
  
  // Context
  context: Record<string, unknown>;
  requestedAt: string;
  expiresAt?: string;
  
  // Status
  status: ApprovalStatus;
  decisions: ApprovalDecision[];
  
  // TTL
  ttl?: number;
}
```

### Container: `workflow-templates`
**Partition Key**: `/category`

```typescript
interface WorkflowTemplate {
  id: string;
  templateId: string;
  name: string;
  description: string;
  category: string;              // Partition key
  tags: string[];
  
  baseWorkflow: {
    triggers: TriggerDefinition[];
    steps: WorkflowStep[];
    variables: Record<string, VariableDefinition>;
    settings?: WorkflowSettings;
  };
  
  requiredVariables: string[];
  configurationSchema?: object;
  isPublic: boolean;
  organizationId?: string;
  
  createdAt: string;
  createdBy: string;
  version: number;
}
```

### Container: `workflow-canvas`
**Partition Key**: `/workflowId`

```typescript
interface CanvasState {
  id: string;
  workflowId: string;            // Partition key
  version: number;
  nodePositions: Record<string, { x: number; y: number }>;
  viewport: { x: number; y: number; zoom: number };
  updatedAt: string;
  updatedBy: string;
}
```

---

## 5. Event Catalog

### Events Published

| Event Type | Description | Consumers |
|------------|-------------|-----------|
| `workflow.definition.created` | Workflow created | Audit Service |
| `workflow.definition.updated` | Workflow updated | Audit Service |
| `workflow.definition.activated` | Workflow activated | Audit Service |
| `workflow.definition.deactivated` | Workflow deactivated | Audit Service |
| `workflow.instance.started` | Instance started | Audit Service |
| `workflow.instance.completed` | Instance completed | Audit Service, Analytics |
| `workflow.instance.failed` | Instance failed | Audit Service, Notification |
| `workflow.instance.cancelled` | Instance cancelled | Audit Service |
| `workflow.step.completed` | Step completed | Audit Service |
| `workflow.step.failed` | Step failed | Audit Service |
| `workflow.approval.required` | Approval needed | Notification Service |
| `workflow.approval.completed` | Decision made | Audit Service |
| `workflow.approval.escalated` | Approval escalated | Notification Service |
| `workflow.approval.expired` | Approval expired | Audit Service |

### Events Consumed

| Event Type | Source | Workflow Use Case |
|------------|--------|-------------------|
| `form.intake.submitted` | Form Service | Start intake processing workflow |
| `policy.nearing_expiry` | Policy Service | Start renewal workflow |
| `customer.created` | Customer Service | Start onboarding workflow |
| `lead.created` | Lead Service | Start lead assignment workflow |
| `lead.stage_changed` | Lead Service | Continue lead processing workflow |
| `quote.generated` | Quote Service | Continue quote-to-bind workflow |
| `aml.check.completed` | Compliance Service | Resume policy binding workflow |
| `document.uploaded` | Document Service | Start document verification workflow |
| `document.expired` | Document Service | Start document renewal workflow |

---

## 6. Security Integration

### 6.1 Authentication Integration

**Current State**: Simple base64 token parsing for development.

**Required Integration**: Integrate with Authentication Service.

```typescript
// CURRENT (to be replaced)
export const extractUserContext = (request: HttpRequest): UserContext | null => {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  }
  return null;
};

// REQUIRED (integration with Authentication Service)
export const extractUserContext = async (request: HttpRequest): Promise<UserContext | null> => {
  const token = request.cookies.get('nectaria_access_token') 
    || request.headers.get('authorization')?.replace('Bearer ', '');
    
  if (!token) return null;
  
  // Call Authentication Service to validate token
  const response = await fetch(`${AUTH_SERVICE_URL}/api/auth/introspect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Key': INTERNAL_SERVICE_KEY
    },
    body: JSON.stringify({ token })
  });
  
  const result = await response.json();
  if (!result.active) return null;
  
  return {
    userId: result.userId,
    email: result.email,
    roles: result.roles,
    permissions: result.permissions,
    organizationId: result.organizationId
  };
};
```

### 6.2 Authorization Integration

**Current State**: Basic role checking in `ensureRole()`.

**Required Integration**: Integrate with Authorization Service.

```typescript
// CURRENT (basic role check)
export const ensureRole = (userContext: UserContext, requiredRoles: string[]): void => {
  const hasRole = requiredRoles.some(role => userContext.roles.includes(role));
  if (!hasRole) throw new AuthorizationError('Access denied');
};

// REQUIRED (integration with Authorization Service)
export const checkPermission = async (
  userContext: UserContext,
  permission: string,
  resource?: { type: string; id: string }
): Promise<boolean> => {
  const response = await fetch(`${AUTHZ_SERVICE_URL}/api/authz/check-resource`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Key': INTERNAL_SERVICE_KEY
    },
    body: JSON.stringify({
      userId: userContext.userId,
      permission,
      resource
    })
  });
  
  const result = await response.json();
  return result.authorized;
};
```

### 6.3 Audit Integration

**Current State**: Publishes events to Event Grid.

**Required Enhancement**: Enrich events with actor context for Audit Service.

```typescript
// Event payload should include actor context
interface WorkflowAuditEvent {
  eventType: string;
  subject: string;
  data: {
    workflowId: string;
    instanceId?: string;
    stepId?: string;
    organizationId: string;
    
    // Actor context for audit
    actorId: string;
    actorEmail: string;
    ipAddress: string;
    userAgent: string;
    
    // Change details
    action: string;
    before?: object;
    after?: object;
  };
}
```

### 6.4 Permission Matrix

| Permission | super-admin | compliance | broker-mgr | senior-broker | junior-broker |
|------------|:-----------:|:----------:|:----------:|:-------------:|:-------------:|
| `workflows:create` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `workflows:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `workflows:update` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `workflows:delete` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `workflows:manage` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `workflows:execute` | ✅ | ❌ | ✅ | ✅ | ✅ |
| `instances:read` | ✅ | ✅ | ✅ | ✅ (own) | ✅ (own) |
| `instances:cancel` | ✅ | ❌ | ✅ | ✅ (own) | ❌ |
| `approvals:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `approvals:decide` | ✅ | ❌ | ✅ | ✅ | ❌ |
| `approvals:reassign` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `templates:create` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `templates:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `analytics:read` | ✅ | ✅ | ✅ | ❌ | ❌ |

---

## 7. Service Integrations

### 7.1 Staff Management Integration

**Current Gap**: Approval steps use `approverRoles` but don't resolve to actual staff members.

**Required Integration**:

```typescript
// When creating approval request, resolve approvers
const resolveApprovers = async (
  humanConfig: HumanConfig,
  organizationId: string
): Promise<{ userIds: string[]; emails: string[] }> => {
  const approvers: string[] = [];
  
  // Direct user IDs
  if (humanConfig.approverUsers) {
    approvers.push(...humanConfig.approverUsers);
  }
  
  // Resolve roles to users via Staff Management Service
  if (humanConfig.approverRoles) {
    for (const role of humanConfig.approverRoles) {
      const response = await fetch(
        `${STAFF_SERVICE_URL}/api/staff?role=${role}&organizationId=${organizationId}`,
        { headers: { 'X-Service-Key': INTERNAL_SERVICE_KEY } }
      );
      const staff = await response.json();
      approvers.push(...staff.members.map((s: any) => s.staffId));
    }
  }
  
  return { userIds: [...new Set(approvers)] };
};
```

### 7.2 Integration Points with Other Services

#### Lead Service → Workflow Service

```json
{
  "name": "Lead Assignment Workflow",
  "description": "Automatically assigns leads to brokers based on territory and workload",
  "triggers": [{
    "type": "event",
    "config": { "eventType": "LeadCreatedEvent" }
  }],
  "steps": [
    {
      "id": "assign-broker",
      "type": "action",
      "action": {
        "type": "http_request",
        "config": {
          "url": "{{env.STAFF_SERVICE_URL}}/api/territories/{{input.territory}}/staff",
          "method": "GET"
        },
        "outputVariable": "availableBrokers"
      }
    },
    {
      "id": "select-broker",
      "type": "script",
      "scriptConfig": {
        "code": "return $.availableBrokers.sort((a,b) => a.workload.activeLeads - b.workload.activeLeads)[0]"
      },
      "outputVariable": "selectedBroker"
    },
    {
      "id": "update-lead",
      "type": "action",
      "action": {
        "type": "http_request",
        "config": {
          "url": "{{env.LEAD_SERVICE_URL}}/api/leads/{{input.leadId}}",
          "method": "PATCH",
          "body": { "assignedTo": "{{$.selectedBroker.staffId}}" }
        }
      }
    }
  ]
}
```

#### Form Service → Workflow Service

```json
{
  "name": "Intake Form Processing",
  "description": "Processes submitted intake forms and triggers quote generation",
  "triggers": [{
    "type": "event",
    "config": { "eventType": "IntakeFormSubmittedEvent" }
  }],
  "steps": [
    {
      "id": "validate-form",
      "type": "action",
      "action": {
        "type": "http_request",
        "config": {
          "url": "{{env.FORM_SERVICE_URL}}/api/intakes/{{input.intakeId}}/validate",
          "method": "POST"
        }
      }
    },
    {
      "id": "check-validation",
      "type": "decision",
      "conditions": [
        {
          "targetStepId": "request-corrections",
          "condition": { "left": "steps.validate-form.output.valid", "operator": "eq", "right": false }
        },
        { "targetStepId": "generate-quotes", "isDefault": true }
      ]
    },
    {
      "id": "generate-quotes",
      "type": "action",
      "action": {
        "type": "publish_event",
        "config": {
          "eventType": "GenerateQuoteCommand",
          "data": { "intakeId": "{{input.intakeId}}", "insuranceLine": "{{input.insuranceLine}}" }
        }
      }
    }
  ]
}
```

#### Policy Service → Workflow Service

```json
{
  "name": "Policy Renewal Workflow",
  "description": "Handles policy renewal 60 days before expiry",
  "triggers": [{
    "type": "event",
    "config": { "eventType": "PolicyNearingExpiryEvent" }
  }],
  "steps": [
    {
      "id": "pre-fill-intake",
      "type": "action",
      "action": {
        "type": "http_request",
        "config": {
          "url": "{{env.FORM_SERVICE_URL}}/api/intakes/prefill",
          "method": "POST",
          "body": { "policyId": "{{input.policyId}}", "customerId": "{{input.customerId}}" }
        }
      }
    },
    {
      "id": "notify-customer",
      "type": "action",
      "action": {
        "type": "send_notification",
        "config": {
          "channel": "email",
          "template": "policy-renewal-reminder",
          "to": "{{input.customerEmail}}"
        }
      }
    },
    {
      "id": "wait-for-response",
      "type": "wait",
      "waitConfig": {
        "type": "event",
        "eventType": "CustomerRenewalResponseEvent",
        "filter": "data.policyId == '{{input.policyId}}'",
        "timeout": 604800
      }
    }
  ]
}
```

#### Quote-to-Bind Saga (Quote Service + Policy Service)

```json
{
  "name": "Quote-to-Bind Saga",
  "description": "Orchestrates quote generation, approval, and policy binding",
  "triggers": [{
    "type": "event",
    "config": { "eventType": "IntakeFormSubmittedEvent" }
  }],
  "steps": [
    {
      "id": "generate-quotes",
      "type": "parallel",
      "parallelConfig": {
        "branches": [
          {
            "id": "insurer-a",
            "steps": [{
              "id": "call-insurer-a",
              "type": "action",
              "action": { "type": "publish_event", "config": { "eventType": "GenerateApiQuoteCommand" }}
            }]
          },
          {
            "id": "insurer-b",
            "steps": [{
              "id": "call-insurer-b",
              "type": "action",
              "action": { "type": "publish_event", "config": { "eventType": "GenerateRpaQuoteCommand" }}
            }]
          }
        ],
        "joinCondition": "all",
        "timeout": 86400
      }
    },
    {
      "id": "broker-review",
      "type": "human",
      "humanConfig": {
        "approverRoles": ["senior-broker"],
        "requiredApprovals": 1,
        "expiresInSeconds": 86400,
        "context": { "displayFields": ["quotes", "customerInfo"] }
      }
    },
    {
      "id": "customer-approval",
      "type": "human",
      "humanConfig": {
        "approverUsers": ["{{$.customerId}}"],
        "requiredApprovals": 1,
        "expiresInSeconds": 604800
      }
    },
    {
      "id": "aml-check",
      "type": "action",
      "action": {
        "type": "publish_event",
        "config": { "eventType": "AMLCheckRequestedEvent" }
      }
    },
    {
      "id": "wait-aml",
      "type": "wait",
      "waitConfig": {
        "type": "event",
        "eventType": "AMLCheckCompletedEvent",
        "filter": "data.customerId == '{{$.customerId}}'",
        "timeout": 86400
      }
    },
    {
      "id": "bind-policy",
      "type": "action",
      "action": {
        "type": "publish_event",
        "config": { "eventType": "BindPolicyCommand" }
      }
    }
  ]
}
```

---

## 8. Gaps & Enhancements

### 8.1 Security Gaps (P1 - Must Fix)

| Gap ID | Description | Current State | Required Change |
|--------|-------------|---------------|-----------------|
| SEC-001 | Token validation | Base64 decode | Call Authentication Service |
| SEC-002 | Permission checks | Basic role check | Call Authorization Service |
| SEC-003 | Audit logging | Event publish only | Enrich with actor context |
| SEC-004 | Organization isolation | Manual check | Automatic enforcement |

### 8.2 Functional Gaps (P2 - Should Fix)

| Gap ID | Description | Impact | Solution |
|--------|-------------|--------|----------|
| FUNC-001 | Approver resolution | Roles not resolved to users | Integrate Staff Service |
| FUNC-002 | Escalation notifications | No notification sent | Integrate Notification Service |
| FUNC-003 | Workflow scheduling | Basic CRON only | Add timezone support |
| FUNC-004 | Instance cleanup | Manual TTL | Automated cleanup job |

### 8.3 Integration Gaps (P2 - Should Fix)

| Gap ID | Description | Solution |
|--------|-------------|----------|
| INT-001 | No lead workflow templates | Create lead assignment template |
| INT-002 | No policy workflow templates | Create renewal/endorsement templates |
| INT-003 | No form workflow templates | Create intake processing template |
| INT-004 | No customer workflow templates | Create onboarding template |

### 8.4 Enhancement Roadmap

| Phase | Enhancement | Priority |
|-------|-------------|----------|
| Phase 1 | Authentication Service integration | P1 |
| Phase 1 | Authorization Service integration | P1 |
| Phase 1 | Audit event enrichment | P1 |
| Phase 2 | Staff Service approver resolution | P2 |
| Phase 2 | Notification Service integration | P2 |
| Phase 2 | Pre-built workflow templates | P2 |
| Phase 3 | Visual workflow designer improvements | P3 |
| Phase 3 | AI-powered workflow suggestions | P3 |

---

## 9. Test Coverage

### 9.1 Current Test Files

| Test File | Description | Status |
|-----------|-------------|--------|
| `approvalRepository.test.ts` | Approval CRUD | ✅ |
| `conditionEvaluator.test.ts` | Condition logic | ✅ |
| `eventPublisher.test.ts` | Event publishing | ✅ |
| `expressionResolver.test.ts` | Variable resolution | ✅ |
| `httpExecutor.test.ts` | HTTP actions | ✅ |
| `stepExecutors.test.ts` | Step execution | ✅ |
| `telemetry.test.ts` | Telemetry | ✅ |
| `templateRepository.test.ts` | Template CRUD | ✅ |
| `validation.test.ts` | Schema validation | ✅ |
| `workflowRepository.test.ts` | Workflow CRUD | ✅ |

### 9.2 Required Additional Tests

```typescript
describe('Security Integration', () => {
  it('should validate token via Authentication Service');
  it('should check permissions via Authorization Service');
  it('should reject invalid tokens');
  it('should enforce organization isolation');
  it('should include actor context in audit events');
});

describe('Staff Integration', () => {
  it('should resolve approver roles to staff members');
  it('should filter approvers by territory');
  it('should handle staff not found');
});

describe('Workflow Templates', () => {
  it('should create lead assignment workflow from template');
  it('should create policy renewal workflow from template');
  it('should create intake processing workflow from template');
  it('should create quote-to-bind workflow from template');
});

describe('End-to-End Workflows', () => {
  it('should complete lead assignment workflow');
  it('should complete policy renewal workflow');
  it('should complete quote-to-bind saga');
  it('should handle approval timeout and escalation');
});
```

---

## 10. Deployment

### 10.1 Environment Variables

```bash
# Core
COSMOS_ENDPOINT=
COSMOS_KEY=
COSMOS_DATABASE_ID=workflow-db

# Event Grid
EVENT_GRID_TOPIC_ENDPOINT=
EVENT_GRID_TOPIC_KEY=

# Service Integration
AUTH_SERVICE_URL=https://auth-service.azurewebsites.net
AUTHZ_SERVICE_URL=https://authz-service.azurewebsites.net
STAFF_SERVICE_URL=https://staff-service.azurewebsites.net
AUDIT_SERVICE_URL=https://audit-service.azurewebsites.net
LEAD_SERVICE_URL=https://lead-service.azurewebsites.net
FORM_SERVICE_URL=https://form-service.azurewebsites.net
POLICY_SERVICE_URL=https://policy-service.azurewebsites.net

# Internal Service Key (for service-to-service calls)
INTERNAL_SERVICE_KEY=

# SignalR (for real-time updates)
AZURE_SIGNALR_CONNECTION_STRING=
```

### 10.2 Cosmos DB Containers

| Container | Partition Key | TTL | RU/s |
|-----------|---------------|-----|------|
| `workflow-definitions` | `/workflowId` | None | 400 |
| `workflow-instances` | `/workflowId` | 90 days | 1000 |
| `workflow-triggers` | `/eventType` | None | 400 |
| `workflow-approvals` | `/organizationId` | 30 days | 400 |
| `workflow-templates` | `/category` | None | 400 |
| `workflow-canvas` | `/workflowId` | None | 400 |

### 10.3 Event Grid Subscriptions

| Subscription | Event Types | Handler |
|--------------|-------------|---------|
| `workflow-triggers` | `*` (filtered) | `httpTriggerHandler.ts` |

---

## Appendix A: Pre-built Workflow Templates

### A.1 Lead Assignment Workflow

Automatically assigns leads to brokers based on territory and workload balancing.

**Trigger**: `LeadCreatedEvent`

**Steps**:
1. Fetch available brokers in territory
2. Select broker with lowest workload
3. Update lead assignment
4. Notify broker

### A.2 Quote-to-Bind Saga

Orchestrates the entire quote-to-bind process with parallel quote generation, broker review, customer approval, AML check, and policy binding.

**Trigger**: `IntakeFormSubmittedEvent`

**Steps**:
1. Generate quotes in parallel (API + RPA)
2. Broker review and selection (human)
3. Customer approval (human)
4. Parallel: AML check + Policy binding
5. Complete saga

### A.3 Policy Renewal Workflow

Handles policy renewal 60 days before expiry with customer notification, intake pre-fill, and quote regeneration.

**Trigger**: `PolicyNearingExpiryEvent`

**Steps**:
1. Pre-fill intake from existing policy
2. Notify customer
3. Wait for customer response
4. Start quote-to-bind saga

### A.4 Document Verification Workflow

Verifies uploaded documents and triggers follow-up if expired or invalid.

**Trigger**: `DocumentUploadedEvent`

**Steps**:
1. Check document expiry
2. Validate document type
3. Decision: valid / invalid / expired
4. Notify customer if action needed

### A.5 Customer Onboarding Workflow

Guides new customers through onboarding with welcome emails, document collection, and profile completion.

**Trigger**: `CustomerCreatedEvent`

**Steps**:
1. Send welcome email
2. Request document uploads
3. Wait for documents (with reminders)
4. Verify documents
5. Complete profile

---

## Appendix B: File Structure

```
workflow-service/
├── src/
│   ├── functions/
│   │   ├── admin/              # Workflow management APIs (15 files)
│   │   │   ├── activateWorkflow.ts
│   │   │   ├── addStep.ts
│   │   │   ├── cloneWorkflow.ts
│   │   │   ├── createWorkflow.ts
│   │   │   ├── deactivateWorkflow.ts
│   │   │   ├── deleteStep.ts
│   │   │   ├── deleteWorkflow.ts
│   │   │   ├── getCanvas.ts
│   │   │   ├── getWorkflow.ts
│   │   │   ├── getWorkflowVersions.ts
│   │   │   ├── listWorkflows.ts
│   │   │   ├── reorderSteps.ts
│   │   │   ├── saveCanvas.ts
│   │   │   ├── updateStep.ts
│   │   │   ├── updateWorkflow.ts
│   │   │   └── validateWorkflow.ts
│   │   ├── analytics/          # Analytics APIs (2 files)
│   │   │   ├── getOverview.ts
│   │   │   └── getWorkflowAnalytics.ts
│   │   ├── approvals/          # Approval APIs (4 files)
│   │   │   ├── getApproval.ts
│   │   │   ├── listPendingApprovals.ts
│   │   │   ├── reassignApproval.ts
│   │   │   └── submitApprovalDecision.ts
│   │   ├── instances/          # Instance APIs (4 files)
│   │   │   ├── cancelInstance.ts
│   │   │   ├── getInstance.ts
│   │   │   ├── getInstanceLogs.ts
│   │   │   └── listInstances.ts
│   │   ├── signalr/            # Real-time updates (1 file)
│   │   │   └── negotiate.ts
│   │   ├── templates/          # Template APIs (6 files)
│   │   │   ├── createFromTemplate.ts
│   │   │   ├── createTemplate.ts
│   │   │   ├── deleteTemplate.ts
│   │   │   ├── getTemplate.ts
│   │   │   ├── listTemplates.ts
│   │   │   └── updateTemplate.ts
│   │   └── triggers/           # Trigger handlers (1 file)
│   │       └── httpTriggerHandler.ts
│   ├── lib/
│   │   ├── engine/             # Core workflow engine
│   │   │   ├── conditionEvaluator.ts
│   │   │   ├── expressionResolver.ts
│   │   │   └── workflowOrchestrator.ts
│   │   ├── executors/          # Step executors
│   │   │   ├── cosmosExecutor.ts
│   │   │   ├── eventPublishExecutor.ts
│   │   │   ├── httpExecutor.ts
│   │   │   ├── scriptExecutor.ts
│   │   │   ├── stepExecutorDispatcher.ts
│   │   │   └── transformExecutor.ts
│   │   ├── repositories/       # Data access layer
│   │   │   ├── approvalRepository.ts
│   │   │   ├── canvasRepository.ts
│   │   │   ├── instanceRepository.ts
│   │   │   ├── templateRepository.ts
│   │   │   ├── triggerRepository.ts
│   │   │   └── workflowRepository.ts
│   │   └── utils/              # Utilities
│   │       ├── auth.ts
│   │       ├── corsHelper.ts
│   │       └── httpResponses.ts
│   ├── models/
│   │   └── workflowTypes.ts    # Type definitions
│   ├── schemas/
│   │   └── workflowDefinition.schema.json
│   ├── data/
│   │   └── seedTemplates.ts    # Pre-built templates
│   └── tests/                  # Unit tests (10 files)
├── host.json
├── local.settings.json
├── package.json
├── tsconfig.json
└── REQUIREMENTS.md
```

---

**Document Version**: 1.0  
**Created**: December 3, 2025  
**Last Updated**: December 3, 2025  
**Status**: APPROVED

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-03 | AI Assistant | Initial requirements document |

