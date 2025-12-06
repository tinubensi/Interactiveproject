/**
 * Approval Repository
 * Data access layer for pipeline approval requests
 */

import { v4 as uuidv4 } from 'uuid';
import { getApprovalsContainer } from '../lib/cosmosClient';
import type {
  ApprovalRequest,
  ApprovalStatus,
  PredefinedApproverRole,
} from '../models/pipeline';
import { getApproverById } from '../constants/predefined';

// =============================================================================
// Error Classes
// =============================================================================

export class ApprovalNotFoundError extends Error {
  constructor(approvalId: string) {
    super(`Approval not found: ${approvalId}`);
    this.name = 'ApprovalNotFoundError';
  }
}

// =============================================================================
// Create Operations
// =============================================================================

/**
 * Create a new approval request
 */
export async function createApproval(params: {
  instanceId: string;
  pipelineId: string;
  leadId: string;
  stepId: string;
  stepName: string;
  approverRole: PredefinedApproverRole;
  escalationRole?: PredefinedApproverRole;
  timeoutHours?: number;
  leadReferenceId?: string;
  leadSummary?: Record<string, unknown>;
}): Promise<ApprovalRequest> {
  const container = getApprovalsContainer();
  const now = new Date().toISOString();
  const approvalId = uuidv4();

  // Get default timeout from approver definition
  const approverDef = getApproverById(params.approverRole);
  const timeoutHours = params.timeoutHours ?? approverDef?.defaultTimeoutHours ?? 24;

  // Calculate expiry time
  let expiresAt: string | undefined;
  if (timeoutHours > 0) {
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + timeoutHours);
    expiresAt = expiryDate.toISOString();
  }

  const approval: ApprovalRequest = {
    id: approvalId,
    approvalId,
    instanceId: params.instanceId,
    pipelineId: params.pipelineId,
    leadId: params.leadId,
    stepId: params.stepId,
    stepName: params.stepName,
    approverRole: params.approverRole,
    escalationRole: params.escalationRole,
    status: 'pending',
    leadReferenceId: params.leadReferenceId,
    leadSummary: params.leadSummary,
    requestedAt: now,
    expiresAt,
    createdAt: now,
  };

  const { resource } = await container.items.create(approval);
  return resource as ApprovalRequest;
}

// =============================================================================
// Read Operations
// =============================================================================

/**
 * Get an approval by ID
 */
export async function getApproval(approvalId: string): Promise<ApprovalRequest> {
  const container = getApprovalsContainer();

  const query = {
    query: 'SELECT * FROM c WHERE c.approvalId = @approvalId',
    parameters: [{ name: '@approvalId', value: approvalId }],
  };

  const { resources } = await container.items.query<ApprovalRequest>(query).fetchAll();

  if (resources.length === 0) {
    throw new ApprovalNotFoundError(approvalId);
  }

  return resources[0];
}

/**
 * Get approval by instance ID
 */
export async function getApprovalByInstanceId(
  instanceId: string
): Promise<ApprovalRequest | null> {
  const container = getApprovalsContainer();

  const query = {
    query: `
      SELECT * FROM c 
      WHERE c.instanceId = @instanceId 
      AND c.status = 'pending'
      ORDER BY c.createdAt DESC
    `,
    parameters: [{ name: '@instanceId', value: instanceId }],
  };

  const { resources } = await container.items.query<ApprovalRequest>(query).fetchAll();

  return resources.length > 0 ? resources[0] : null;
}

/**
 * List pending approvals for a specific role
 */
export async function listPendingApprovalsForRole(
  approverRole: PredefinedApproverRole,
  organizationId?: string
): Promise<ApprovalRequest[]> {
  const container = getApprovalsContainer();

  let query = `
    SELECT * FROM c 
    WHERE c.approverRole = @approverRole 
    AND c.status = 'pending'
  `;
  const parameters: Array<{ name: string; value: string }> = [
    { name: '@approverRole', value: approverRole },
  ];

  // Note: We don't have organizationId directly on approval, 
  // but we could join with instance data if needed
  // For now, we'll return all pending approvals for the role

  query += ' ORDER BY c.requestedAt ASC';

  const { resources } = await container.items
    .query<ApprovalRequest>({ query, parameters })
    .fetchAll();

  return resources;
}

/**
 * List all pending approvals
 */
export async function listPendingApprovals(filters?: {
  approverRole?: PredefinedApproverRole;
  pipelineId?: string;
  leadId?: string;
}): Promise<ApprovalRequest[]> {
  const container = getApprovalsContainer();

  let query = "SELECT * FROM c WHERE c.status = 'pending'";
  const parameters: Array<{ name: string; value: string }> = [];

  if (filters?.approverRole) {
    query += ' AND c.approverRole = @approverRole';
    parameters.push({ name: '@approverRole', value: filters.approverRole });
  }

  if (filters?.pipelineId) {
    query += ' AND c.pipelineId = @pipelineId';
    parameters.push({ name: '@pipelineId', value: filters.pipelineId });
  }

  if (filters?.leadId) {
    query += ' AND c.leadId = @leadId';
    parameters.push({ name: '@leadId', value: filters.leadId });
  }

  query += ' ORDER BY c.requestedAt ASC';

  const { resources } = await container.items
    .query<ApprovalRequest>({ query, parameters })
    .fetchAll();

  return resources;
}

/**
 * List approvals by status
 */
export async function listApprovalsByStatus(
  status: ApprovalStatus
): Promise<ApprovalRequest[]> {
  const container = getApprovalsContainer();

  const query = {
    query: 'SELECT * FROM c WHERE c.status = @status ORDER BY c.updatedAt DESC',
    parameters: [{ name: '@status', value: status }],
  };

  const { resources } = await container.items.query<ApprovalRequest>(query).fetchAll();

  return resources;
}

/**
 * Get expired pending approvals
 */
export async function getExpiredApprovals(): Promise<ApprovalRequest[]> {
  const container = getApprovalsContainer();
  const now = new Date().toISOString();

  const query = {
    query: `
      SELECT * FROM c 
      WHERE c.status = 'pending' 
      AND c.expiresAt < @now
    `,
    parameters: [{ name: '@now', value: now }],
  };

  const { resources } = await container.items.query<ApprovalRequest>(query).fetchAll();

  return resources;
}

// =============================================================================
// Update Operations
// =============================================================================

/**
 * Submit an approval decision
 */
export async function submitDecision(
  approvalId: string,
  decision: 'approved' | 'rejected',
  decidedBy: string,
  decidedByName?: string,
  comment?: string
): Promise<ApprovalRequest> {
  const approval = await getApproval(approvalId);
  const container = getApprovalsContainer();
  const now = new Date().toISOString();

  if (approval.status !== 'pending') {
    throw new Error(`Approval ${approvalId} is not pending (status: ${approval.status})`);
  }

  const updatedApproval: ApprovalRequest = {
    ...approval,
    status: decision === 'approved' ? 'approved' : 'rejected',
    decision,
    decidedBy,
    decidedByName,
    decidedAt: now,
    comment,
    updatedAt: now,
  };

  const { resource } = await container
    .item(approval.id, approval.instanceId)
    .replace(updatedApproval);

  return resource as ApprovalRequest;
}

/**
 * Mark an approval as expired
 */
export async function expireApproval(approvalId: string): Promise<ApprovalRequest> {
  const approval = await getApproval(approvalId);
  const container = getApprovalsContainer();
  const now = new Date().toISOString();

  const updatedApproval: ApprovalRequest = {
    ...approval,
    status: 'expired',
    updatedAt: now,
  };

  const { resource } = await container
    .item(approval.id, approval.instanceId)
    .replace(updatedApproval);

  return resource as ApprovalRequest;
}

/**
 * Escalate an approval to a different role
 */
export async function escalateApproval(
  approvalId: string,
  newApproverRole: PredefinedApproverRole
): Promise<ApprovalRequest> {
  const approval = await getApproval(approvalId);
  const container = getApprovalsContainer();
  const now = new Date().toISOString();

  // Get new timeout from approver definition
  const approverDef = getApproverById(newApproverRole);
  const timeoutHours = approverDef?.defaultTimeoutHours ?? 24;

  // Calculate new expiry time
  let newExpiresAt: string | undefined;
  if (timeoutHours > 0) {
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + timeoutHours);
    newExpiresAt = expiryDate.toISOString();
  }

  const updatedApproval: ApprovalRequest = {
    ...approval,
    approverRole: newApproverRole,
    escalatedAt: now,
    expiresAt: newExpiresAt,
    updatedAt: now,
  };

  const { resource } = await container
    .item(approval.id, approval.instanceId)
    .replace(updatedApproval);

  return resource as ApprovalRequest;
}

// =============================================================================
// Delete Operations
// =============================================================================

/**
 * Cancel a pending approval
 */
export async function cancelApproval(approvalId: string): Promise<void> {
  const approval = await getApproval(approvalId);
  const container = getApprovalsContainer();
  const now = new Date().toISOString();

  const updatedApproval: ApprovalRequest = {
    ...approval,
    status: 'expired', // Using expired status for cancellations
    updatedAt: now,
  };

  await container.item(approval.id, approval.instanceId).replace(updatedApproval);
}

