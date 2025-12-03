"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const workflowRepository_1 = require("../lib/repositories/workflowRepository");
// Note: Full repository tests require Cosmos DB integration.
// These tests verify the error classes and type definitions.
(0, node_test_1.describe)('WorkflowRepository Error Classes', () => {
    (0, node_test_1.describe)('WorkflowNotFoundError', () => {
        (0, node_test_1.it)('should create error with workflow ID', () => {
            const error = new workflowRepository_1.WorkflowNotFoundError('wf-123');
            node_assert_1.default.strictEqual(error.name, 'WorkflowNotFoundError');
            node_assert_1.default.ok(error.message.includes('wf-123'));
            node_assert_1.default.ok(error.message.includes('not found'));
        });
        (0, node_test_1.it)('should create error with workflow ID and version', () => {
            const error = new workflowRepository_1.WorkflowNotFoundError('wf-123', 2);
            node_assert_1.default.ok(error.message.includes('wf-123'));
            node_assert_1.default.ok(error.message.includes('version 2'));
        });
    });
    (0, node_test_1.describe)('StepNotFoundError', () => {
        (0, node_test_1.it)('should create error with step ID', () => {
            const error = new workflowRepository_1.StepNotFoundError('step-123');
            node_assert_1.default.strictEqual(error.name, 'StepNotFoundError');
            node_assert_1.default.ok(error.message.includes('step-123'));
            node_assert_1.default.ok(error.message.includes('not found'));
        });
    });
    (0, node_test_1.describe)('WorkflowValidationError', () => {
        (0, node_test_1.it)('should create error with message', () => {
            const error = new workflowRepository_1.WorkflowValidationError('Invalid workflow');
            node_assert_1.default.strictEqual(error.name, 'WorkflowValidationError');
            node_assert_1.default.strictEqual(error.message, 'Invalid workflow');
        });
    });
});
(0, node_test_1.describe)('WorkflowRepository Type Definitions', () => {
    (0, node_test_1.it)('should create valid workflow definition structure', () => {
        const workflow = {
            id: 'wf-123-v1',
            workflowId: 'wf-123',
            name: 'Test Workflow',
            version: 1,
            status: 'draft',
            organizationId: 'org-123',
            triggers: [],
            steps: [],
            createdAt: new Date().toISOString(),
            createdBy: 'user-1'
        };
        node_assert_1.default.strictEqual(workflow.workflowId, 'wf-123');
        node_assert_1.default.strictEqual(workflow.version, 1);
        node_assert_1.default.strictEqual(workflow.status, 'draft');
    });
    (0, node_test_1.it)('should create valid workflow step structure', () => {
        const step = {
            id: 'step-1',
            name: 'HTTP Request Step',
            type: 'action',
            order: 1,
            action: {
                type: 'http_request',
                config: {
                    url: 'https://api.example.com',
                    method: 'GET'
                },
                outputVariable: 'apiResponse'
            }
        };
        node_assert_1.default.strictEqual(step.type, 'action');
        node_assert_1.default.strictEqual(step.action?.type, 'http_request');
    });
    (0, node_test_1.it)('should create valid decision step with conditions', () => {
        const step = {
            id: 'step-2',
            name: 'Decision',
            type: 'decision',
            order: 2,
            conditions: [
                {
                    targetStepId: 'step-3',
                    condition: {
                        left: '$.amount',
                        operator: 'gt',
                        right: 1000
                    }
                },
                {
                    targetStepId: 'step-4',
                    isDefault: true
                }
            ]
        };
        node_assert_1.default.strictEqual(step.conditions?.length, 2);
        node_assert_1.default.strictEqual(step.conditions?.[0].targetStepId, 'step-3');
    });
    (0, node_test_1.it)('should create valid parallel step with branches', () => {
        const step = {
            id: 'step-3',
            name: 'Parallel Execution',
            type: 'parallel',
            order: 3,
            parallelConfig: {
                branches: [
                    {
                        id: 'branch-1',
                        name: 'Branch 1',
                        steps: [
                            { id: 'b1-s1', name: 'B1 Step 1', type: 'terminate', order: 1 }
                        ]
                    },
                    {
                        id: 'branch-2',
                        name: 'Branch 2',
                        steps: [
                            { id: 'b2-s1', name: 'B2 Step 1', type: 'terminate', order: 1 }
                        ]
                    }
                ],
                joinCondition: 'all'
            }
        };
        node_assert_1.default.strictEqual(step.parallelConfig?.branches.length, 2);
        node_assert_1.default.strictEqual(step.parallelConfig?.joinCondition, 'all');
    });
    (0, node_test_1.it)('should create valid wait step for event', () => {
        const step = {
            id: 'step-4',
            name: 'Wait for Event',
            type: 'wait',
            order: 4,
            waitConfig: {
                type: 'event',
                eventType: 'CustomerApprovedEvent',
                eventFilter: '$.customerId == "{{$.customerId}}"'
            },
            timeout: 86400
        };
        node_assert_1.default.strictEqual(step.waitConfig?.type, 'event');
    });
    (0, node_test_1.it)('should create valid wait step for approval', () => {
        const step = {
            id: 'step-5',
            name: 'Wait for Approval',
            type: 'wait',
            order: 5,
            waitConfig: {
                type: 'approval',
                approverRoles: ['manager', 'admin'],
                requiredApprovals: 1
            }
        };
        node_assert_1.default.strictEqual(step.waitConfig?.type, 'approval');
    });
    (0, node_test_1.it)('should create valid loop step', () => {
        const step = {
            id: 'step-6',
            name: 'Process Items',
            type: 'loop',
            order: 6,
            loopConfig: {
                collection: '$.items',
                itemVariable: 'currentItem',
                indexVariable: 'index',
                maxIterations: 100,
                parallelism: 5,
                steps: [
                    { id: 'loop-s1', name: 'Process Item', type: 'terminate', order: 1 }
                ]
            }
        };
        node_assert_1.default.strictEqual(step.loopConfig?.collection, '$.items');
        node_assert_1.default.strictEqual(step.loopConfig?.parallelism, 5);
    });
    (0, node_test_1.it)('should create valid transform step', () => {
        const step = {
            id: 'step-7',
            name: 'Transform Data',
            type: 'transform',
            order: 7,
            transformConfig: {
                expression: '$.items[status = "active"]',
                outputVariable: 'activeItems'
            }
        };
        node_assert_1.default.strictEqual(step.transformConfig?.outputVariable, 'activeItems');
    });
    (0, node_test_1.it)('should create valid script step', () => {
        const step = {
            id: 'step-8',
            name: 'Custom Script',
            type: 'script',
            order: 8,
            scriptConfig: {
                code: 'return input.items.filter(i => i.price > 100).length',
                timeout: 5000,
                allowedGlobals: ['Math', 'Date', 'JSON']
            },
            outputVariable: 'expensiveCount'
        };
        node_assert_1.default.strictEqual(step.scriptConfig?.timeout, 5000);
    });
    (0, node_test_1.it)('should create valid subworkflow step', () => {
        const step = {
            id: 'step-9',
            name: 'Call Subworkflow',
            type: 'subworkflow',
            order: 9,
            subworkflowConfig: {
                workflowId: 'child-workflow-1',
                version: 2,
                inputMapping: {
                    customerId: '$.customerId',
                    orderId: '$.orderId'
                },
                outputMapping: {
                    result: '$.subworkflowResult'
                },
                waitForCompletion: true
            }
        };
        node_assert_1.default.strictEqual(step.subworkflowConfig?.workflowId, 'child-workflow-1');
    });
    (0, node_test_1.it)('should create valid step with error handling', () => {
        const step = {
            id: 'step-10',
            name: 'Risky Operation',
            type: 'action',
            order: 10,
            action: {
                type: 'http_request',
                config: {
                    url: 'https://api.example.com',
                    method: 'POST',
                    body: { data: '{{$.payload}}' }
                }
            },
            onError: {
                action: 'retry',
                retryPolicy: {
                    maxAttempts: 3,
                    backoffType: 'exponential',
                    initialDelaySeconds: 5,
                    maxDelaySeconds: 300,
                    retryableErrors: ['TIMEOUT', 'SERVICE_UNAVAILABLE']
                },
                fallbackStepId: 'error-handler'
            }
        };
        node_assert_1.default.strictEqual(step.onError?.action, 'retry');
        node_assert_1.default.strictEqual(step.onError?.retryPolicy?.maxAttempts, 3);
    });
    (0, node_test_1.it)('should create valid create workflow request', () => {
        const request = {
            name: 'New Workflow',
            organizationId: 'org-123',
            description: 'A new workflow',
            triggers: [
                {
                    id: 'trigger-1',
                    type: 'event',
                    config: {
                        eventType: 'OrderCreatedEvent',
                        extractVariables: {
                            orderId: '$.data.orderId',
                            customerId: '$.data.customerId'
                        }
                    }
                }
            ],
            steps: [
                { id: 'step-1', name: 'Start', type: 'terminate', order: 1 }
            ],
            variables: {
                orderId: { type: 'string', required: true },
                customerId: { type: 'string', required: true }
            },
            settings: {
                maxExecutionDurationSeconds: 86400,
                allowParallelExecutions: true,
                executionRetentionDays: 90,
                notifyOnFailure: ['admin@example.com']
            },
            tags: ['orders', 'automated'],
            category: 'order-processing'
        };
        node_assert_1.default.strictEqual(request.name, 'New Workflow');
        node_assert_1.default.strictEqual(request.triggers?.length, 1);
        node_assert_1.default.strictEqual(request.variables?.orderId.type, 'string');
    });
});
(0, node_test_1.describe)('Workflow Complex Structures', () => {
    (0, node_test_1.it)('should create workflow with compound conditions', () => {
        const step = {
            id: 'complex-decision',
            name: 'Complex Decision',
            type: 'decision',
            order: 1,
            conditions: [
                {
                    targetStepId: 'premium-path',
                    condition: {
                        operator: 'and',
                        conditions: [
                            { left: '$.amount', operator: 'gt', right: 10000 },
                            { left: '$.customerType', operator: 'eq', right: 'VIP' }
                        ]
                    }
                },
                {
                    targetStepId: 'standard-path',
                    condition: {
                        operator: 'or',
                        conditions: [
                            { left: '$.priority', operator: 'eq', right: 'high' },
                            { left: '$.isUrgent', operator: 'eq', right: true }
                        ]
                    }
                },
                {
                    targetStepId: 'default-path',
                    isDefault: true
                }
            ]
        };
        node_assert_1.default.strictEqual(step.conditions?.length, 3);
        const firstCondition = step.conditions?.[0].condition;
        node_assert_1.default.ok(firstCondition && 'operator' in firstCondition);
        if (firstCondition && 'operator' in firstCondition) {
            node_assert_1.default.strictEqual(firstCondition.operator, 'and');
        }
    });
    (0, node_test_1.it)('should create workflow with all action types', () => {
        const actionTypes = [
            {
                type: 'http_request',
                config: { url: 'https://api.example.com', method: 'GET' }
            },
            {
                type: 'publish_event',
                config: { eventType: 'TestEvent', data: {} }
            },
            {
                type: 'send_command',
                config: { queueName: 'commands', command: {} }
            },
            {
                type: 'cosmos_query',
                config: { container: 'items', query: 'SELECT * FROM c' }
            },
            {
                type: 'cosmos_upsert',
                config: { container: 'items', document: {} }
            },
            {
                type: 'cosmos_delete',
                config: { container: 'items', documentId: 'doc-1', partitionKey: 'pk-1' }
            },
            {
                type: 'send_notification',
                config: { channel: 'email', to: 'user@example.com' }
            },
            {
                type: 'call_function',
                config: { functionName: 'ProcessOrder' }
            }
        ];
        const steps = actionTypes.map((action, index) => ({
            id: `step-${index}`,
            name: `${action.type} Step`,
            type: 'action',
            order: index + 1,
            action: {
                type: action.type,
                config: action.config
            }
        }));
        node_assert_1.default.strictEqual(steps.length, 8);
        steps.forEach((step, index) => {
            node_assert_1.default.strictEqual(step.action?.type, actionTypes[index].type);
        });
    });
});
//# sourceMappingURL=workflowRepository.test.js.map