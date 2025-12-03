"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const approvalRepository_1 = require("../lib/repositories/approvalRepository");
(0, node_test_1.describe)('Approval Repository', () => {
    (0, node_test_1.describe)('ApprovalNotFoundError', () => {
        (0, node_test_1.it)('should create error with correct message', () => {
            const error = new approvalRepository_1.ApprovalNotFoundError('approval-123');
            node_assert_1.default.strictEqual(error.name, 'ApprovalNotFoundError');
            node_assert_1.default.strictEqual(error.message, 'Approval approval-123 not found');
            node_assert_1.default.ok(error instanceof Error);
        });
    });
    (0, node_test_1.describe)('ApprovalRequest Type Definitions', () => {
        (0, node_test_1.it)('should create valid pending approval request', () => {
            const approval = {
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
            node_assert_1.default.strictEqual(approval.status, 'pending');
            node_assert_1.default.strictEqual(approval.requiredApprovals, 2);
            node_assert_1.default.strictEqual(approval.currentApprovals, 0);
            node_assert_1.default.ok(Array.isArray(approval.approverRoles));
            node_assert_1.default.ok(Array.isArray(approval.approverUsers));
        });
        (0, node_test_1.it)('should create valid approved approval request', () => {
            const decisions = [
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
            const approval = {
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
            node_assert_1.default.strictEqual(approval.status, 'approved');
            node_assert_1.default.strictEqual(approval.currentApprovals, 2);
            node_assert_1.default.strictEqual(approval.decisions.length, 2);
        });
        (0, node_test_1.it)('should create valid rejected approval request', () => {
            const decisions = [
                {
                    userId: 'user-1',
                    userName: 'John Doe',
                    decision: 'rejected',
                    comment: 'Budget exceeded',
                    decidedAt: new Date().toISOString()
                }
            ];
            const approval = {
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
            node_assert_1.default.strictEqual(approval.status, 'rejected');
            node_assert_1.default.strictEqual(approval.decisions[0].decision, 'rejected');
            node_assert_1.default.ok(approval.decisions[0].comment);
        });
    });
    (0, node_test_1.describe)('ApprovalDecision Type Definitions', () => {
        (0, node_test_1.it)('should create valid approval decision', () => {
            const decision = {
                userId: 'user-123',
                userName: 'John Doe',
                decision: 'approved',
                comment: 'Looks good to me',
                data: { additionalInfo: 'Some extra data' },
                decidedAt: new Date().toISOString()
            };
            node_assert_1.default.strictEqual(decision.decision, 'approved');
            node_assert_1.default.ok(decision.userId);
            node_assert_1.default.ok(decision.decidedAt);
        });
        (0, node_test_1.it)('should create valid rejection decision', () => {
            const decision = {
                userId: 'user-456',
                decision: 'rejected',
                comment: 'Insufficient documentation',
                decidedAt: new Date().toISOString()
            };
            node_assert_1.default.strictEqual(decision.decision, 'rejected');
            node_assert_1.default.ok(decision.comment);
        });
    });
    (0, node_test_1.describe)('ApprovalStatus Type', () => {
        (0, node_test_1.it)('should accept valid status values', () => {
            const validStatuses = [
                'pending',
                'approved',
                'rejected',
                'reassigned',
                'expired'
            ];
            validStatuses.forEach((status) => {
                node_assert_1.default.ok(typeof status === 'string');
            });
        });
    });
    (0, node_test_1.describe)('Approval Context', () => {
        (0, node_test_1.it)('should support arbitrary context data', () => {
            const approval = {
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
            node_assert_1.default.strictEqual(approval.context.amount, 10000);
            node_assert_1.default.ok(Array.isArray(approval.context.items));
        });
    });
});
//# sourceMappingURL=approvalRepository.test.js.map