/**
 * Audit Client - Sends audit logs to Audit Service
 */

import { UserContext } from '@nectaria/shared-types';

const AUDIT_SERVICE_URL = process.env.AUDIT_SERVICE_URL || 'http://localhost:7073';
const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || '';

/**
 * Audit event types for workflow operations
 */
export const WORKFLOW_AUDIT_EVENTS = {
  // Workflow lifecycle
  WORKFLOW_CREATED: 'workflow.created',
  WORKFLOW_UPDATED: 'workflow.updated',
  WORKFLOW_DELETED: 'workflow.deleted',
  WORKFLOW_ACTIVATED: 'workflow.activated',
  WORKFLOW_DEACTIVATED: 'workflow.deactivated',
  WORKFLOW_CLONED: 'workflow.cloned',
  
  // Instance lifecycle
  INSTANCE_STARTED: 'workflow.instance.started',
  INSTANCE_COMPLETED: 'workflow.instance.completed',
  INSTANCE_FAILED: 'workflow.instance.failed',
  INSTANCE_CANCELLED: 'workflow.instance.cancelled',
  
  // Approval events
  APPROVAL_CREATED: 'workflow.approval.created',
  APPROVAL_DECIDED: 'workflow.approval.decided',
  APPROVAL_REASSIGNED: 'workflow.approval.reassigned',
  APPROVAL_ESCALATED: 'workflow.approval.escalated',
} as const;

export type WorkflowAuditEventType = typeof WORKFLOW_AUDIT_EVENTS[keyof typeof WORKFLOW_AUDIT_EVENTS];

/**
 * Audit log action types
 */
export type AuditAction = 'create' | 'read' | 'update' | 'delete' | 'execute' | 'approve' | 'reject' | 'reassign' | 'cancel';

/**
 * Log an audit event to the Audit Service
 */
export async function logAuditEvent(
  eventType: WorkflowAuditEventType,
  action: AuditAction,
  entityType: string,
  entityId: string,
  userContext: UserContext,
  details?: Record<string, unknown>,
  previousState?: Record<string, unknown>,
  newState?: Record<string, unknown>
): Promise<void> {
  // Skip if no audit service configured
  if (!INTERNAL_SERVICE_KEY) {
    console.log(`[Audit] ${eventType} - ${action} on ${entityType}/${entityId} by ${userContext.userId}`);
    return;
  }

  try {
    const auditPayload = {
      eventType,
      action,
      entityType,
      entityId,
      userId: userContext.userId,
      userEmail: userContext.email,
      userName: userContext.name,
      userRoles: userContext.roles,
      details: {
        ...details,
        source: 'workflow-service',
      },
      previousState,
      newState,
      ipAddress: details?.ipAddress as string | undefined,
      userAgent: details?.userAgent as string | undefined,
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(`${AUDIT_SERVICE_URL}/api/audit/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': INTERNAL_SERVICE_KEY,
      },
      body: JSON.stringify(auditPayload),
    });

    if (!response.ok) {
      console.error(`[Audit] Failed to log event: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    // Log locally but don't fail the operation
    console.error('[Audit] Error logging event:', error);
  }
}

/**
 * Log workflow creation
 */
export async function logWorkflowCreated(
  workflowId: string,
  workflowName: string,
  userContext: UserContext,
  details?: Record<string, unknown>
): Promise<void> {
  await logAuditEvent(
    WORKFLOW_AUDIT_EVENTS.WORKFLOW_CREATED,
    'create',
    'workflow',
    workflowId,
    userContext,
    { workflowName, ...details }
  );
}

/**
 * Log workflow update
 */
export async function logWorkflowUpdated(
  workflowId: string,
  userContext: UserContext,
  previousState?: Record<string, unknown>,
  newState?: Record<string, unknown>
): Promise<void> {
  await logAuditEvent(
    WORKFLOW_AUDIT_EVENTS.WORKFLOW_UPDATED,
    'update',
    'workflow',
    workflowId,
    userContext,
    undefined,
    previousState,
    newState
  );
}

/**
 * Log workflow deletion
 */
export async function logWorkflowDeleted(
  workflowId: string,
  workflowName: string,
  userContext: UserContext
): Promise<void> {
  await logAuditEvent(
    WORKFLOW_AUDIT_EVENTS.WORKFLOW_DELETED,
    'delete',
    'workflow',
    workflowId,
    userContext,
    { workflowName }
  );
}

/**
 * Log approval decision
 */
export async function logApprovalDecision(
  approvalId: string,
  decision: 'approved' | 'rejected',
  userContext: UserContext,
  details?: Record<string, unknown>
): Promise<void> {
  await logAuditEvent(
    WORKFLOW_AUDIT_EVENTS.APPROVAL_DECIDED,
    decision === 'approved' ? 'approve' : 'reject',
    'approval',
    approvalId,
    userContext,
    { decision, ...details }
  );
}

/**
 * Log approval reassignment
 */
export async function logApprovalReassigned(
  approvalId: string,
  fromUserId: string,
  toUserId: string,
  userContext: UserContext,
  reason?: string
): Promise<void> {
  await logAuditEvent(
    WORKFLOW_AUDIT_EVENTS.APPROVAL_REASSIGNED,
    'reassign',
    'approval',
    approvalId,
    userContext,
    { fromUserId, toUserId, reason }
  );
}

/**
 * Log instance cancellation
 */
export async function logInstanceCancelled(
  instanceId: string,
  workflowId: string,
  userContext: UserContext,
  reason?: string
): Promise<void> {
  await logAuditEvent(
    WORKFLOW_AUDIT_EVENTS.INSTANCE_CANCELLED,
    'cancel',
    'workflow-instance',
    instanceId,
    userContext,
    { workflowId, reason }
  );
}

