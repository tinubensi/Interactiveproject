"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const telemetry_1 = require("../lib/telemetry");
(0, node_test_1.describe)('Telemetry', () => {
    let capturedEvents = [];
    const mockTelemetryClient = {
        trackEvent(name, properties) {
            capturedEvents.push({ type: 'event', name, data: properties });
        },
        trackMetric(name, value, properties) {
            capturedEvents.push({ type: 'metric', name, data: { value, properties } });
        },
        trackException(error, properties) {
            capturedEvents.push({
                type: 'exception',
                name: error.message,
                data: properties
            });
        },
        trackDependency(name, data, duration, success, properties) {
            capturedEvents.push({
                type: 'dependency',
                name,
                data: { data, duration, success, properties }
            });
        },
        async flush() {
            // No-op
        }
    };
    (0, node_test_1.beforeEach)(() => {
        capturedEvents = [];
        (0, telemetry_1.initializeTelemetry)(mockTelemetryClient);
    });
    (0, node_test_1.describe)('initializeTelemetry', () => {
        (0, node_test_1.it)('should set the telemetry client', () => {
            const client = (0, telemetry_1.getTelemetryClient)();
            node_assert_1.default.strictEqual(client, mockTelemetryClient);
        });
    });
    (0, node_test_1.describe)('trackWorkflowStarted', () => {
        (0, node_test_1.it)('should track workflow started event', () => {
            const instance = {
                id: 'inst-123',
                instanceId: 'inst-123',
                workflowId: 'wf-123',
                workflowName: 'Test Workflow',
                workflowVersion: 1,
                organizationId: 'org-123',
                status: 'running',
                triggerId: 'trigger-123',
                triggerType: 'http',
                createdAt: new Date().toISOString(),
                stepExecutions: [],
                completedStepIds: [],
                variables: {}
            };
            (0, telemetry_1.trackWorkflowStarted)(instance);
            node_assert_1.default.strictEqual(capturedEvents.length, 1);
            node_assert_1.default.strictEqual(capturedEvents[0].type, 'event');
            node_assert_1.default.strictEqual(capturedEvents[0].name, 'WorkflowStarted');
            node_assert_1.default.ok(capturedEvents[0].data.instanceId);
        });
    });
    (0, node_test_1.describe)('trackWorkflowCompleted', () => {
        (0, node_test_1.it)('should track workflow completed event and metrics', () => {
            const instance = {
                id: 'inst-123',
                instanceId: 'inst-123',
                workflowId: 'wf-123',
                workflowName: 'Test Workflow',
                workflowVersion: 1,
                organizationId: 'org-123',
                status: 'completed',
                triggerId: 'trigger-123',
                triggerType: 'http',
                createdAt: new Date().toISOString(),
                stepExecutions: [],
                completedStepIds: ['step-1', 'step-2'],
                variables: {}
            };
            (0, telemetry_1.trackWorkflowCompleted)(instance, 5000);
            // Should track event and two metrics
            node_assert_1.default.strictEqual(capturedEvents.length, 3);
            node_assert_1.default.strictEqual(capturedEvents[0].name, 'WorkflowCompleted');
            node_assert_1.default.strictEqual(capturedEvents[1].name, 'workflow.duration');
            node_assert_1.default.strictEqual(capturedEvents[2].name, 'workflow.steps.count');
        });
    });
    (0, node_test_1.describe)('trackWorkflowFailed', () => {
        (0, node_test_1.it)('should track workflow failed event and exception', () => {
            const instance = {
                id: 'inst-123',
                instanceId: 'inst-123',
                workflowId: 'wf-123',
                workflowName: 'Test Workflow',
                workflowVersion: 1,
                organizationId: 'org-123',
                status: 'failed',
                triggerId: 'trigger-123',
                triggerType: 'http',
                createdAt: new Date().toISOString(),
                currentStepId: 'step-2',
                stepExecutions: [],
                completedStepIds: ['step-1'],
                variables: {}
            };
            const error = new Error('Step execution failed');
            (0, telemetry_1.trackWorkflowFailed)(instance, error);
            node_assert_1.default.strictEqual(capturedEvents.length, 2);
            node_assert_1.default.strictEqual(capturedEvents[0].name, 'WorkflowFailed');
            node_assert_1.default.strictEqual(capturedEvents[1].type, 'exception');
        });
    });
    (0, node_test_1.describe)('trackStepExecution', () => {
        (0, node_test_1.it)('should track step execution event and duration metric', () => {
            const instance = {
                id: 'inst-123',
                instanceId: 'inst-123',
                workflowId: 'wf-123',
                workflowName: 'Test Workflow',
                workflowVersion: 1,
                organizationId: 'org-123',
                status: 'running',
                triggerId: 'trigger-123',
                triggerType: 'http',
                createdAt: new Date().toISOString(),
                stepExecutions: [],
                completedStepIds: [],
                variables: {}
            };
            const stepExecution = {
                stepId: 'step-1',
                stepName: 'Process Data',
                stepType: 'action',
                status: 'completed',
                startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                durationMs: 150
            };
            (0, telemetry_1.trackStepExecution)(instance, stepExecution);
            node_assert_1.default.strictEqual(capturedEvents.length, 2);
            node_assert_1.default.strictEqual(capturedEvents[0].name, 'StepExecuted');
            node_assert_1.default.strictEqual(capturedEvents[1].name, 'step.duration');
        });
        (0, node_test_1.it)('should track exception for failed steps', () => {
            const instance = {
                id: 'inst-123',
                instanceId: 'inst-123',
                workflowId: 'wf-123',
                workflowName: 'Test Workflow',
                workflowVersion: 1,
                organizationId: 'org-123',
                status: 'running',
                triggerId: 'trigger-123',
                triggerType: 'http',
                createdAt: new Date().toISOString(),
                stepExecutions: [],
                completedStepIds: [],
                variables: {}
            };
            const stepExecution = {
                stepId: 'step-1',
                stepName: 'Process Data',
                stepType: 'action',
                status: 'failed',
                startedAt: new Date().toISOString(),
                error: {
                    code: 'HTTP_500',
                    message: 'Internal server error'
                }
            };
            (0, telemetry_1.trackStepExecution)(instance, stepExecution);
            const exceptions = capturedEvents.filter((e) => e.type === 'exception');
            node_assert_1.default.strictEqual(exceptions.length, 1);
            node_assert_1.default.strictEqual(exceptions[0].name, 'Internal server error');
        });
    });
});
//# sourceMappingURL=telemetry.test.js.map