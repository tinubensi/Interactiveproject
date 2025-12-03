import { ApprovalRequest } from '../../models/workflowTypes';
export declare class ApprovalNotFoundError extends Error {
    constructor(approvalId: string);
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
export declare const createApproval: (params: CreateApprovalParams) => Promise<ApprovalRequest>;
/**
 * Get an approval request by ID
 */
export declare const getApproval: (approvalId: string) => Promise<ApprovalRequest>;
/**
 * Get pending approvals for a user
 */
export declare const getPendingApprovalsForUser: (userId: string, roles: string[], organizationId?: string) => Promise<ApprovalRequest[]>;
/**
 * Get pending approvals for an instance
 */
export declare const getPendingApprovalsForInstance: (instanceId: string) => Promise<ApprovalRequest[]>;
/**
 * Record an approval decision
 */
export declare const recordApprovalDecision: (approvalId: string, userId: string, userName: string | undefined, decision: 'approved' | 'rejected', comment?: string, data?: Record<string, unknown>) => Promise<ApprovalRequest>;
/**
 * Reassign an approval
 */
export declare const reassignApproval: (approvalId: string, toUserId: string, reason?: string) => Promise<ApprovalRequest>;
/**
 * Expire old pending approvals
 */
export declare const expireApprovals: () => Promise<number>;
//# sourceMappingURL=approvalRepository.d.ts.map