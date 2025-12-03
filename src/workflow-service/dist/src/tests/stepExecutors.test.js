"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const stepExecutorDispatcher_1 = require("../lib/executors/stepExecutorDispatcher");
const transformExecutor_1 = require("../lib/executors/transformExecutor");
const scriptExecutor_1 = require("../lib/executors/scriptExecutor");
(0, node_test_1.describe)('Step Executors', () => {
    (0, node_test_1.describe)('executeStep', () => {
        (0, node_test_1.it)('should skip disabled steps', async () => {
            const step = {
                id: 'step-1',
                name: 'Disabled Step',
                type: 'action',
                order: 1,
                isEnabled: false,
                action: {
                    type: 'http_request',
                    config: { url: 'https://api.example.com', method: 'GET' }
                }
            };
            const context = {
                instanceId: 'inst-1',
                workflowId: 'wf-1',
                workflowVersion: 1,
                organizationId: 'org-1',
                variables: {},
                stepOutputs: {}
            };
            const result = await (0, stepExecutorDispatcher_1.executeStep)(step, context);
            node_assert_1.default.strictEqual(result.success, true);
            node_assert_1.default.ok(result.output.skipped);
        });
        (0, node_test_1.it)('should execute decision step correctly', async () => {
            const step = {
                id: 'decision-1',
                name: 'Decision Step',
                type: 'decision',
                order: 1,
                conditions: [
                    {
                        targetStepId: 'high-value-step',
                        condition: { left: '$.amount', operator: 'gt', right: 1000 }
                    },
                    {
                        targetStepId: 'default-step',
                        isDefault: true
                    }
                ]
            };
            const context = {
                instanceId: 'inst-1',
                workflowId: 'wf-1',
                workflowVersion: 1,
                organizationId: 'org-1',
                variables: { amount: 1500 },
                stepOutputs: {}
            };
            const result = await (0, stepExecutorDispatcher_1.executeStep)(step, context);
            node_assert_1.default.strictEqual(result.success, true);
            node_assert_1.default.strictEqual(result.nextStepId, 'high-value-step');
        });
        (0, node_test_1.it)('should execute setVariable step correctly', async () => {
            const step = {
                id: 'set-var-1',
                name: 'Set Variables',
                type: 'setVariable',
                order: 1,
                setVariables: {
                    greeting: 'Hello, {{$.name}}!',
                    count: 42
                }
            };
            const context = {
                instanceId: 'inst-1',
                workflowId: 'wf-1',
                workflowVersion: 1,
                organizationId: 'org-1',
                variables: { name: 'World' },
                stepOutputs: {}
            };
            const result = await (0, stepExecutorDispatcher_1.executeStep)(step, context);
            node_assert_1.default.strictEqual(result.success, true);
            node_assert_1.default.ok(result.variableUpdates);
            node_assert_1.default.strictEqual(result.variableUpdates?.greeting, 'Hello, World!');
            node_assert_1.default.strictEqual(result.variableUpdates?.count, 42);
        });
        (0, node_test_1.it)('should execute terminate step correctly', async () => {
            const step = {
                id: 'end-1',
                name: 'End',
                type: 'terminate',
                order: 100
            };
            const context = {
                instanceId: 'inst-1',
                workflowId: 'wf-1',
                workflowVersion: 1,
                organizationId: 'org-1',
                variables: {},
                stepOutputs: {}
            };
            const result = await (0, stepExecutorDispatcher_1.executeStep)(step, context);
            node_assert_1.default.strictEqual(result.success, true);
            node_assert_1.default.strictEqual(result.shouldTerminate, true);
        });
        (0, node_test_1.it)('should execute delay step correctly', async () => {
            const step = {
                id: 'delay-1',
                name: 'Wait 5 seconds',
                type: 'delay',
                order: 1,
                delaySeconds: 5
            };
            const context = {
                instanceId: 'inst-1',
                workflowId: 'wf-1',
                workflowVersion: 1,
                organizationId: 'org-1',
                variables: {},
                stepOutputs: {}
            };
            const result = await (0, stepExecutorDispatcher_1.executeStep)(step, context);
            node_assert_1.default.strictEqual(result.success, true);
            node_assert_1.default.ok(result.output.requiresOrchestration);
            node_assert_1.default.strictEqual(result.output.delaySeconds, 5);
        });
        (0, node_test_1.it)('should handle unknown step type', async () => {
            const step = {
                id: 'unknown-1',
                name: 'Unknown Step',
                type: 'unknownType',
                order: 1
            };
            const context = {
                instanceId: 'inst-1',
                workflowId: 'wf-1',
                workflowVersion: 1,
                organizationId: 'org-1',
                variables: {},
                stepOutputs: {}
            };
            const result = await (0, stepExecutorDispatcher_1.executeStep)(step, context);
            node_assert_1.default.strictEqual(result.success, false);
            node_assert_1.default.ok(result.error?.code.includes('UNKNOWN'));
        });
    });
    (0, node_test_1.describe)('Transform Executor', () => {
        (0, node_test_1.it)('should execute JSONata transformation', async () => {
            const context = {
                variables: {
                    items: [
                        { name: 'Item 1', price: 100 },
                        { name: 'Item 2', price: 200 },
                        { name: 'Item 3', price: 50 }
                    ]
                },
                stepOutputs: {},
                input: {}
            };
            const result = await (0, transformExecutor_1.executeTransform)({
                expression: '$sum(items.price)',
                outputVariable: 'totalPrice'
            }, context);
            node_assert_1.default.strictEqual(result.success, true);
            node_assert_1.default.strictEqual(result.data, 350);
            node_assert_1.default.strictEqual(result.outputVariable, 'totalPrice');
        });
        (0, node_test_1.it)('should filter items with JSONata', async () => {
            const context = {
                variables: {
                    items: [
                        { name: 'Item 1', price: 100, active: true },
                        { name: 'Item 2', price: 200, active: false },
                        { name: 'Item 3', price: 50, active: true }
                    ]
                },
                stepOutputs: {},
                input: {}
            };
            const result = await (0, transformExecutor_1.executeTransform)({
                expression: 'items[active = true]',
                outputVariable: 'activeItems'
            }, context);
            node_assert_1.default.strictEqual(result.success, true);
            node_assert_1.default.ok(Array.isArray(result.data));
            node_assert_1.default.strictEqual(result.data.length, 2);
        });
        (0, node_test_1.it)('should handle invalid JSONata expression', async () => {
            const context = {
                variables: {},
                stepOutputs: {},
                input: {}
            };
            const result = await (0, transformExecutor_1.executeTransform)({
                expression: 'invalid[[[expression',
                outputVariable: 'result'
            }, context);
            node_assert_1.default.strictEqual(result.success, false);
            node_assert_1.default.ok(result.error);
        });
        (0, node_test_1.it)('should convert transform result to step result', () => {
            const transformResult = {
                success: true,
                data: 100,
                outputVariable: 'total'
            };
            const stepResult = (0, transformExecutor_1.transformResultToStepResult)(transformResult);
            node_assert_1.default.strictEqual(stepResult.success, true);
            node_assert_1.default.strictEqual(stepResult.output, 100);
            node_assert_1.default.ok(stepResult.variableUpdates);
            node_assert_1.default.strictEqual(stepResult.variableUpdates?.total, 100);
        });
    });
    (0, node_test_1.describe)('Script Executor', () => {
        (0, node_test_1.it)('should execute simple script', async () => {
            const context = {
                variables: { a: 5, b: 10 },
                stepOutputs: {},
                input: {}
            };
            const result = await (0, scriptExecutor_1.executeScript)({
                code: 'return $.a + $.b;',
                timeout: 5000
            }, context);
            node_assert_1.default.strictEqual(result.success, true);
            node_assert_1.default.strictEqual(result.data, 15);
        });
        (0, node_test_1.it)('should access allowed globals', async () => {
            const context = {
                variables: { value: 4.7 },
                stepOutputs: {},
                input: {}
            };
            const result = await (0, scriptExecutor_1.executeScript)({
                code: 'return Math.round($.value);',
                timeout: 5000,
                allowedGlobals: ['Math']
            }, context);
            node_assert_1.default.strictEqual(result.success, true);
            node_assert_1.default.strictEqual(result.data, 5);
        });
        (0, node_test_1.it)('should handle script errors', async () => {
            const context = {
                variables: {},
                stepOutputs: {},
                input: {}
            };
            const result = await (0, scriptExecutor_1.executeScript)({
                code: 'throw new Error("Test error");',
                timeout: 5000
            }, context);
            node_assert_1.default.strictEqual(result.success, false);
            node_assert_1.default.ok(result.error);
            node_assert_1.default.ok(result.error?.message.includes('Test error'));
        });
        (0, node_test_1.it)('should convert script result to step result with output variable', () => {
            const scriptResult = {
                success: true,
                data: 'result value'
            };
            const stepResult = (0, scriptExecutor_1.scriptResultToStepResult)(scriptResult, 'myVar');
            node_assert_1.default.strictEqual(stepResult.success, true);
            node_assert_1.default.strictEqual(stepResult.output, 'result value');
            node_assert_1.default.ok(stepResult.variableUpdates);
            node_assert_1.default.strictEqual(stepResult.variableUpdates?.myVar, 'result value');
        });
    });
    (0, node_test_1.describe)('determineNextStep', () => {
        const steps = [
            { id: 'step-1', name: 'Step 1', type: 'action', order: 1, action: { type: 'http_request', config: { url: '', method: 'GET' } } },
            { id: 'step-2', name: 'Step 2', type: 'action', order: 2, action: { type: 'http_request', config: { url: '', method: 'GET' } } },
            { id: 'step-3', name: 'Step 3', type: 'terminate', order: 3 }
        ];
        (0, node_test_1.it)('should use nextStepId from result if present', () => {
            const context = {
                variables: {},
                stepOutputs: {},
                input: {}
            };
            const result = (0, stepExecutorDispatcher_1.determineNextStep)(steps[0], steps, context, { success: true, nextStepId: 'step-3', shouldTerminate: false });
            node_assert_1.default.strictEqual(result, 'step-3');
        });
        (0, node_test_1.it)('should evaluate transitions if present', () => {
            const stepWithTransitions = {
                id: 'step-1',
                name: 'Step 1',
                type: 'action',
                order: 1,
                action: { type: 'http_request', config: { url: '', method: 'GET' } },
                transitions: [
                    {
                        targetStepId: 'step-3',
                        condition: { left: '$.skip', operator: 'eq', right: true }
                    },
                    {
                        targetStepId: 'step-2',
                        isDefault: true
                    }
                ]
            };
            const context = {
                variables: { skip: true },
                stepOutputs: {},
                input: {}
            };
            const result = (0, stepExecutorDispatcher_1.determineNextStep)(stepWithTransitions, steps, context, { success: true, shouldTerminate: false });
            node_assert_1.default.strictEqual(result, 'step-3');
        });
        (0, node_test_1.it)('should return next step by order if no transitions', () => {
            const context = {
                variables: {},
                stepOutputs: {},
                input: {}
            };
            const result = (0, stepExecutorDispatcher_1.determineNextStep)(steps[0], steps, context, { success: true, shouldTerminate: false });
            node_assert_1.default.strictEqual(result, 'step-2');
        });
        (0, node_test_1.it)('should return null for last step', () => {
            const context = {
                variables: {},
                stepOutputs: {},
                input: {}
            };
            const result = (0, stepExecutorDispatcher_1.determineNextStep)(steps[2], steps, context, { success: true, shouldTerminate: false });
            node_assert_1.default.strictEqual(result, null);
        });
    });
});
//# sourceMappingURL=stepExecutors.test.js.map