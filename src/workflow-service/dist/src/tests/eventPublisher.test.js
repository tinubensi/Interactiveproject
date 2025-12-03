"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
(0, node_test_1.describe)('Event Publisher', () => {
    (0, node_test_1.describe)('Event Data Types', () => {
        (0, node_test_1.it)('should create valid WorkflowInstanceStartedEventData structure', () => {
            const data = {
                instanceId: 'inst-123',
                workflowId: 'wf-123',
                workflowName: 'Test Workflow',
                organizationId: 'org-123',
                triggerId: 'trigger-123',
                triggerType: 'http',
                correlationId: 'corr-123'
            };
            node_assert_1.default.ok(data.instanceId);
            node_assert_1.default.ok(data.workflowId);
            node_assert_1.default.ok(data.workflowName);
            node_assert_1.default.ok(data.organizationId);
            node_assert_1.default.ok(data.triggerId);
            node_assert_1.default.ok(data.triggerType);
            node_assert_1.default.ok(data.correlationId);
        });
        (0, node_test_1.it)('should create valid WorkflowInstanceCompletedEventData structure', () => {
            const data = {
                instanceId: 'inst-123',
                workflowId: 'wf-123',
                workflowName: 'Test Workflow',
                organizationId: 'org-123',
                durationMs: 5000,
                finalVariables: { result: 'success' }
            };
            node_assert_1.default.ok(data.instanceId);
            node_assert_1.default.strictEqual(data.durationMs, 5000);
            node_assert_1.default.deepStrictEqual(data.finalVariables, { result: 'success' });
        });
        (0, node_test_1.it)('should create valid WorkflowInstanceFailedEventData structure', () => {
            const error = {
                code: 'STEP_FAILED',
                message: 'Step execution failed'
            };
            const data = {
                instanceId: 'inst-123',
                workflowId: 'wf-123',
                workflowName: 'Test Workflow',
                organizationId: 'org-123',
                error,
                failedStepId: 'step-1',
                failedStepName: 'Validate Input'
            };
            node_assert_1.default.ok(data.instanceId);
            node_assert_1.default.ok(data.error);
            node_assert_1.default.strictEqual(data.error.code, 'STEP_FAILED');
            node_assert_1.default.ok(data.failedStepId);
        });
        (0, node_test_1.it)('should create valid WorkflowStepCompletedEventData structure', () => {
            const data = {
                instanceId: 'inst-123',
                workflowId: 'wf-123',
                stepId: 'step-1',
                stepName: 'Process Data',
                stepType: 'action',
                durationMs: 100,
                output: { processed: true }
            };
            node_assert_1.default.ok(data.instanceId);
            node_assert_1.default.ok(data.stepId);
            node_assert_1.default.strictEqual(data.durationMs, 100);
            node_assert_1.default.deepStrictEqual(data.output, { processed: true });
        });
        (0, node_test_1.it)('should create valid WorkflowApprovalRequiredEventData structure', () => {
            const data = {
                approvalId: 'approval-123',
                instanceId: 'inst-123',
                workflowId: 'wf-123',
                workflowName: 'Test Workflow',
                stepId: 'step-5',
                stepName: 'Manager Approval',
                approverRoles: ['manager', 'admin'],
                approverUsers: ['user-1'],
                context: { amount: 5000 },
                expiresAt: '2025-01-01T00:00:00Z'
            };
            node_assert_1.default.ok(data.approvalId);
            node_assert_1.default.ok(data.stepId);
            node_assert_1.default.ok(Array.isArray(data.approverRoles));
            node_assert_1.default.ok(Array.isArray(data.approverUsers));
            node_assert_1.default.deepStrictEqual(data.context, { amount: 5000 });
        });
        (0, node_test_1.it)('should create valid WorkflowApprovalCompletedEventData structure', () => {
            const data = {
                approvalId: 'approval-123',
                instanceId: 'inst-123',
                workflowId: 'wf-123',
                stepId: 'step-5',
                decision: 'approved',
                decidedBy: 'user-123',
                comment: 'Looks good'
            };
            node_assert_1.default.ok(data.approvalId);
            node_assert_1.default.strictEqual(data.decision, 'approved');
            node_assert_1.default.ok(data.decidedBy);
            node_assert_1.default.ok(data.comment);
        });
    });
    (0, node_test_1.describe)('Event Grid Event Structure', () => {
        (0, node_test_1.it)('should create valid Event Grid event format', () => {
            const event = {
                id: 'event-123',
                eventType: 'WorkflowInstanceStartedEvent',
                subject: '/workflows/wf-123/instances/inst-123',
                eventTime: new Date().toISOString(),
                data: { instanceId: 'inst-123' },
                dataVersion: '1.0'
            };
            node_assert_1.default.ok(event.id);
            node_assert_1.default.ok(event.eventType);
            node_assert_1.default.ok(event.subject);
            node_assert_1.default.ok(event.eventTime);
            node_assert_1.default.ok(event.data);
            node_assert_1.default.strictEqual(event.dataVersion, '1.0');
        });
    });
});
//# sourceMappingURL=eventPublisher.test.js.map