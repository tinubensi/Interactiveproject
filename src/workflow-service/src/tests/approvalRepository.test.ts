import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  ApprovalNotFoundError
} from '../lib/repositories/approvalRepository';
import {
  ApprovalRequest,
  ApprovalDecision,
  ApprovalStatus
} from '../models/workflowTypes';

describe('Approval Repository', () => {
  describe('ApprovalNotFoundError', () => {
    it('should create error with correct message', () => {
      const error = new ApprovalNotFoundError('approval-123');
      
      assert.strictEqual(error.name, 'ApprovalNotFoundError');
      assert.strictEqual(error.message, 'Approval approval-123 not found');
      assert.ok(error instanceof Error);
    });
  });

  describe('ApprovalRequest Type Definitions', () => {
    it('should create valid pending approval request', () => {
      const approval: ApprovalRequest = {
        id: 'approval-123',
        approvalId: 'approval-123',
        instanceId: 'inst-123',
        workflowId: 'wf-123',
        stepId: 'step-5',
        stepName: 'Manager Approval',
        organizationId: 'org-123',
        approverRoles: ['manager'],
        approverUsers: ['user-1', 'user-2'],
        requiredApprovals: 2,
        currentApprovals: 0,
        context: { amount: 5000, description: 'Purchase request' },
        requestedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        status: 'pending',
        decisions: []
      };

      assert.strictEqual(approval.status, 'pending');
      assert.strictEqual(approval.requiredApprovals, 2);
      assert.strictEqual(approval.currentApprovals, 0);
      assert.ok(Array.isArray(approval.approverRoles));
      assert.ok(Array.isArray(approval.approverUsers));
    });

    it('should create valid approved approval request', () => {
      const decisions: ApprovalDecision[] = [
        {
          userId: 'user-1',
          userName: 'John Doe',
          decision: 'approved',
          comment: 'Approved',
          decidedAt: new Date().toISOString()
        },
        {
          userId: 'user-2',
          userName: 'Jane Smith',
          decision: 'approved',
          decidedAt: new Date().toISOString()
        }
      ];

      const approval: ApprovalRequest = {
        id: 'approval-123',
        approvalId: 'approval-123',
        instanceId: 'inst-123',
        workflowId: 'wf-123',
        stepId: 'step-5',
        stepName: 'Manager Approval',
        organizationId: 'org-123',
        requiredApprovals: 2,
        currentApprovals: 2,
        context: {},
        requestedAt: new Date().toISOString(),
        status: 'approved',
        decisions
      };

      assert.strictEqual(approval.status, 'approved');
      assert.strictEqual(approval.currentApprovals, 2);
      assert.strictEqual(approval.decisions.length, 2);
    });

    it('should create valid rejected approval request', () => {
      const decisions: ApprovalDecision[] = [
        {
          userId: 'user-1',
          userName: 'John Doe',
          decision: 'rejected',
          comment: 'Budget exceeded',
          decidedAt: new Date().toISOString()
        }
      ];

      const approval: ApprovalRequest = {
        id: 'approval-123',
        approvalId: 'approval-123',
        instanceId: 'inst-123',
        workflowId: 'wf-123',
        stepId: 'step-5',
        stepName: 'Manager Approval',
        organizationId: 'org-123',
        requiredApprovals: 1,
        currentApprovals: 0,
        context: {},
        requestedAt: new Date().toISOString(),
        status: 'rejected',
        decisions
      };

      assert.strictEqual(approval.status, 'rejected');
      assert.strictEqual(approval.decisions[0].decision, 'rejected');
      assert.ok(approval.decisions[0].comment);
    });
  });

  describe('ApprovalDecision Type Definitions', () => {
    it('should create valid approval decision', () => {
      const decision: ApprovalDecision = {
        userId: 'user-123',
        userName: 'John Doe',
        decision: 'approved',
        comment: 'Looks good to me',
        data: { additionalInfo: 'Some extra data' },
        decidedAt: new Date().toISOString()
      };

      assert.strictEqual(decision.decision, 'approved');
      assert.ok(decision.userId);
      assert.ok(decision.decidedAt);
    });

    it('should create valid rejection decision', () => {
      const decision: ApprovalDecision = {
        userId: 'user-456',
        decision: 'rejected',
        comment: 'Insufficient documentation',
        decidedAt: new Date().toISOString()
      };

      assert.strictEqual(decision.decision, 'rejected');
      assert.ok(decision.comment);
    });
  });

  describe('ApprovalStatus Type', () => {
    it('should accept valid status values', () => {
      const validStatuses: ApprovalStatus[] = [
        'pending',
        'approved',
        'rejected',
        'reassigned',
        'expired'
      ];

      validStatuses.forEach((status) => {
        assert.ok(typeof status === 'string');
      });
    });
  });

  describe('Approval Context', () => {
    it('should support arbitrary context data', () => {
      const approval: ApprovalRequest = {
        id: 'approval-123',
        approvalId: 'approval-123',
        instanceId: 'inst-123',
        workflowId: 'wf-123',
        stepId: 'step-5',
        stepName: 'Manager Approval',
        organizationId: 'org-123',
        requiredApprovals: 1,
        currentApprovals: 0,
        context: {
          amount: 10000,
          currency: 'USD',
          requestedBy: 'user-999',
          items: [
            { name: 'Laptop', price: 1500 },
            { name: 'Monitor', price: 500 }
          ],
          metadata: {
            department: 'Engineering',
            priority: 'high'
          }
        },
        requestedAt: new Date().toISOString(),
        status: 'pending',
        decisions: []
      };

      assert.strictEqual((approval.context as Record<string, unknown>).amount, 10000);
      assert.ok(Array.isArray((approval.context as Record<string, unknown>).items));
    });
  });
});

