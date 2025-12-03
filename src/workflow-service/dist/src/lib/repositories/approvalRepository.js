"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expireApprovals = exports.reassignApproval = exports.recordApprovalDecision = exports.getPendingApprovalsForInstance = exports.getPendingApprovalsForUser = exports.getApproval = exports.createApproval = exports.ApprovalNotFoundError = void 0;
const uuid_1 = require("uuid");
const cosmosClient_1 = require("../cosmosClient");
const config_1 = require("../config");
class ApprovalNotFoundError extends Error {
    constructor(approvalId) {
        super(`Approval ${approvalId} not found`);
        this.name = 'ApprovalNotFoundError';
    }
}
exports.ApprovalNotFoundError = ApprovalNotFoundError;
/**
 * Create an approval request
 */
const createApproval = async (params) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const config = (0, config_1.getConfig)();
    const approvalId = `approval-${(0, uuid_1.v4)().slice(0, 12)}`;
    const now = new Date();
    const expiresAt = params.expiresInSeconds
        ? new Date(now.getTime() + params.expiresInSeconds * 1000).toISOString()
        : undefined;
    const approval = {
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
    return resource;
};
exports.createApproval = createApproval;
/**
 * Get an approval request by ID
 */
const getApproval = async (approvalId) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const query = {
        query: 'SELECT * FROM c WHERE c.approvalId = @approvalId',
        parameters: [{ name: '@approvalId', value: approvalId }]
    };
    const { resources } = await containers.workflowApprovals.items
        .query(query)
        .fetchAll();
    if (resources.length === 0) {
        throw new ApprovalNotFoundError(approvalId);
    }
    return resources[0];
};
exports.getApproval = getApproval;
/**
 * Get pending approvals for a user
 */
const getPendingApprovalsForUser = async (userId, roles, organizationId) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    // Build query for approvals where user is in approverUsers or has a matching role
    let query = `
    SELECT * FROM c 
    WHERE c.status = 'pending'
    AND (
      ARRAY_CONTAINS(c.approverUsers, @userId)
      OR ARRAY_LENGTH(SetIntersect(c.approverRoles, @roles)) > 0
    )
  `;
    const parameters = [
        { name: '@userId', value: userId },
        { name: '@roles', value: roles }
    ];
    if (organizationId) {
        query += ' AND c.organizationId = @organizationId';
        parameters.push({ name: '@organizationId', value: organizationId });
    }
    query += ' ORDER BY c.requestedAt DESC';
    const { resources } = await containers.workflowApprovals.items
        .query({ query, parameters })
        .fetchAll();
    return resources;
};
exports.getPendingApprovalsForUser = getPendingApprovalsForUser;
/**
 * Get pending approvals for an instance
 */
const getPendingApprovalsForInstance = async (instanceId) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
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
        .query(query)
        .fetchAll();
    return resources;
};
exports.getPendingApprovalsForInstance = getPendingApprovalsForInstance;
/**
 * Record an approval decision
 */
const recordApprovalDecision = async (approvalId, userId, userName, decision, comment, data) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const approval = await (0, exports.getApproval)(approvalId);
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
    const newDecision = {
        userId,
        userName,
        decision,
        comment,
        data,
        decidedAt: new Date().toISOString()
    };
    const updatedDecisions = [...approval.decisions, newDecision];
    let newStatus = 'pending';
    let currentApprovals = approval.currentApprovals;
    if (decision === 'approved') {
        currentApprovals++;
        if (currentApprovals >= approval.requiredApprovals) {
            newStatus = 'approved';
        }
    }
    else {
        // Any rejection rejects the whole approval
        newStatus = 'rejected';
    }
    const updatedApproval = {
        ...approval,
        decisions: updatedDecisions,
        currentApprovals,
        status: newStatus
    };
    await containers.workflowApprovals.items.upsert(updatedApproval);
    return updatedApproval;
};
exports.recordApprovalDecision = recordApprovalDecision;
/**
 * Reassign an approval
 */
const reassignApproval = async (approvalId, toUserId, reason) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const approval = await (0, exports.getApproval)(approvalId);
    if (approval.status !== 'pending') {
        throw new Error(`Cannot reassign approval with status ${approval.status}`);
    }
    const updatedApproval = {
        ...approval,
        approverUsers: [toUserId],
        status: 'reassigned',
        decisions: [
            ...approval.decisions,
            {
                userId: 'system',
                decision: 'approved',
                comment: reason || 'Reassigned',
                decidedAt: new Date().toISOString()
            }
        ]
    };
    // Create a new approval for the reassigned user
    const newApproval = await (0, exports.createApproval)({
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
exports.reassignApproval = reassignApproval;
/**
 * Expire old pending approvals
 */
const expireApprovals = async () => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
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
        .query(query)
        .fetchAll();
    let expiredCount = 0;
    for (const approval of resources) {
        await containers.workflowApprovals.items.upsert({
            ...approval,
            status: 'expired'
        });
        expiredCount++;
    }
    return expiredCount;
};
exports.expireApprovals = expireApprovals;
//# sourceMappingURL=approvalRepository.js.map