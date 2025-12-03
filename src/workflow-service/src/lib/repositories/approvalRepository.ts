import { v4 as uuidv4 } from 'uuid';
import { getCosmosContainers } from '../cosmosClient';
import { getConfig } from '../config';
import {
  ApprovalRequest,
  ApprovalDecision,
  ApprovalStatus
} from '../../models/workflowTypes';

export class ApprovalNotFoundError extends Error {
  constructor(approvalId: string) {
    super(`Approval ${approvalId} not found`);
    this.name = 'ApprovalNotFoundError';
  }
}

export interface CreateApprovalParams {
  instanceId: string;
  workflowId: string;
  stepId: string;
  stepName: string;
  organizationId: string;
  approverRoles?: string[];
  approverUsers?: string[];
  requiredApprovals?: number;
  context: Record<string, unknown>;
  expiresInSeconds?: number;
}

/**
 * Create an approval request
 */
export const createApproval = async (
  params: CreateApprovalParams
): Promise<ApprovalRequest> => {
  const containers = await getCosmosContainers();
  const config = getConfig();
  const approvalId = `approval-${uuidv4().slice(0, 12)}`;
  const now = new Date();

  const expiresAt = params.expiresInSeconds
    ? new Date(now.getTime() + params.expiresInSeconds * 1000).toISOString()
    : undefined;

  const approval: ApprovalRequest = {
    id: approvalId,
    approvalId,
    instanceId: params.instanceId,
    workflowId: params.workflowId,
    stepId: params.stepId,
    stepName: params.stepName,
    organizationId: params.organizationId,
    approverRoles: params.approverRoles,
    approverUsers: params.approverUsers,
    requiredApprovals: params.requiredApprovals || 1,
    currentApprovals: 0,
    context: params.context,
    requestedAt: now.toISOString(),
    expiresAt,
    status: 'pending',
    decisions: [],
    ttl: config.settings.approvalTtlSeconds
  };

  const { resource } = await containers.workflowApprovals.items.create(approval);
  return resource as ApprovalRequest;
};

/**
 * Get an approval request by ID
 */
export const getApproval = async (
  approvalId: string
): Promise<ApprovalRequest> => {
  const containers = await getCosmosContainers();

  const query = {
    query: 'SELECT * FROM c WHERE c.approvalId = @approvalId',
    parameters: [{ name: '@approvalId', value: approvalId }]
  };

  const { resources } = await containers.workflowApprovals.items
    .query<ApprovalRequest>(query)
    .fetchAll();

  if (resources.length === 0) {
    throw new ApprovalNotFoundError(approvalId);
  }

  return resources[0];
};

/**
 * Get pending approvals for a user
 */
export const getPendingApprovalsForUser = async (
  userId: string,
  roles: string[],
  organizationId?: string
): Promise<ApprovalRequest[]> => {
  const containers = await getCosmosContainers();

  // Build query for approvals where user is in approverUsers or has a matching role
  let query = `
    SELECT * FROM c 
    WHERE c.status = 'pending'
    AND (
      ARRAY_CONTAINS(c.approverUsers, @userId)
      OR ARRAY_LENGTH(SetIntersect(c.approverRoles, @roles)) > 0
    )
  `;
  const parameters: Array<{ name: string; value: string | string[] }> = [
    { name: '@userId', value: userId },
    { name: '@roles', value: roles }
  ];

  if (organizationId) {
    query += ' AND c.organizationId = @organizationId';
    parameters.push({ name: '@organizationId', value: organizationId });
  }

  query += ' ORDER BY c.requestedAt DESC';

  const { resources } = await containers.workflowApprovals.items
    .query<ApprovalRequest>({ query, parameters })
    .fetchAll();

  return resources;
};

/**
 * Get pending approvals for an instance
 */
export const getPendingApprovalsForInstance = async (
  instanceId: string
): Promise<ApprovalRequest[]> => {
  const containers = await getCosmosContainers();

  const query = {
    query: `
      SELECT * FROM c 
      WHERE c.instanceId = @instanceId 
      AND c.status = 'pending'
      ORDER BY c.requestedAt DESC
    `,
    parameters: [{ name: '@instanceId', value: instanceId }]
  };

  const { resources } = await containers.workflowApprovals.items
    .query<ApprovalRequest>(query)
    .fetchAll();

  return resources;
};

/**
 * Record an approval decision
 */
export const recordApprovalDecision = async (
  approvalId: string,
  userId: string,
  userName: string | undefined,
  decision: 'approved' | 'rejected',
  comment?: string,
  data?: Record<string, unknown>
): Promise<ApprovalRequest> => {
  const containers = await getCosmosContainers();
  const approval = await getApproval(approvalId);

  // Check if already decided
  if (approval.status !== 'pending') {
    throw new Error(`Approval is already ${approval.status}`);
  }

  // Check if user already made a decision
  if (approval.decisions.some((d) => d.userId === userId)) {
    throw new Error('User has already made a decision on this approval');
  }

  // Check expiry
  if (approval.expiresAt && new Date(approval.expiresAt) < new Date()) {
    throw new Error('Approval has expired');
  }

  // Record the decision
  const newDecision: ApprovalDecision = {
    userId,
    userName,
    decision,
    comment,
    data,
    decidedAt: new Date().toISOString()
  };

  const updatedDecisions = [...approval.decisions, newDecision];
  let newStatus: ApprovalStatus = 'pending';
  let currentApprovals = approval.currentApprovals;

  if (decision === 'approved') {
    currentApprovals++;
    if (currentApprovals >= approval.requiredApprovals) {
      newStatus = 'approved';
    }
  } else {
    // Any rejection rejects the whole approval
    newStatus = 'rejected';
  }

  const updatedApproval: ApprovalRequest = {
    ...approval,
    decisions: updatedDecisions,
    currentApprovals,
    status: newStatus
  };

  await containers.workflowApprovals.items.upsert(updatedApproval);
  return updatedApproval;
};

/**
 * Reassign an approval
 */
export const reassignApproval = async (
  approvalId: string,
  toUserId: string,
  reason?: string
): Promise<ApprovalRequest> => {
  const containers = await getCosmosContainers();
  const approval = await getApproval(approvalId);

  if (approval.status !== 'pending') {
    throw new Error(`Cannot reassign approval with status ${approval.status}`);
  }

  const updatedApproval: ApprovalRequest = {
    ...approval,
    approverUsers: [toUserId],
    status: 'reassigned' as ApprovalStatus,
    decisions: [
      ...approval.decisions,
      {
        userId: 'system',
        decision: 'approved', // Placeholder
        comment: reason || 'Reassigned',
        decidedAt: new Date().toISOString()
      }
    ]
  };

  // Create a new approval for the reassigned user
  const newApproval = await createApproval({
    instanceId: approval.instanceId,
    workflowId: approval.workflowId,
    stepId: approval.stepId,
    stepName: approval.stepName,
    organizationId: approval.organizationId,
    approverUsers: [toUserId],
    requiredApprovals: 1,
    context: {
      ...approval.context,
      reassignedFrom: approvalId,
      reassignReason: reason
    }
  });

  await containers.workflowApprovals.items.upsert(updatedApproval);
  return newApproval;
};

/**
 * Expire old pending approvals
 */
export const expireApprovals = async (): Promise<number> => {
  const containers = await getCosmosContainers();
  const now = new Date().toISOString();

  const query = {
    query: `
      SELECT * FROM c 
      WHERE c.status = 'pending' 
      AND c.expiresAt < @now
    `,
    parameters: [{ name: '@now', value: now }]
  };

  const { resources } = await containers.workflowApprovals.items
    .query<ApprovalRequest>(query)
    .fetchAll();

  let expiredCount = 0;
  for (const approval of resources) {
    await containers.workflowApprovals.items.upsert({
      ...approval,
      status: 'expired' as ApprovalStatus
    });
    expiredCount++;
  }

  return expiredCount;
};

