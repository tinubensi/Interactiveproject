"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const validation_1 = require("../lib/validation");
(0, node_test_1.describe)('Validation Module', () => {
    (0, node_test_1.describe)('validateCreateWorkflowRequest', () => {
        (0, node_test_1.it)('should validate a valid create workflow request', () => {
            const request = {
                name: 'Test Workflow',
                organizationId: 'org-123'
            };
            const result = (0, validation_1.validateCreateWorkflowRequest)(request);
            node_assert_1.default.strictEqual(result.name, 'Test Workflow');
            node_assert_1.default.strictEqual(result.organizationId, 'org-123');
        });
        (0, node_test_1.it)('should validate request with all optional fields', () => {
            const request = {
                name: 'Test Workflow',
                organizationId: 'org-123',
                description: 'A test workflow',
                triggers: [],
                steps: [],
                tags: ['test'],
                category: 'testing'
            };
            const result = (0, validation_1.validateCreateWorkflowRequest)(request);
            node_assert_1.default.strictEqual(result.description, 'A test workflow');
            node_assert_1.default.deepStrictEqual(result.triggers, []);
            node_assert_1.default.deepStrictEqual(result.steps, []);
            node_assert_1.default.deepStrictEqual(result.tags, ['test']);
            node_assert_1.default.strictEqual(result.category, 'testing');
        });
        (0, node_test_1.it)('should reject request without name', () => {
            const request = {
                organizationId: 'org-123'
            };
            node_assert_1.default.throws(() => (0, validation_1.validateCreateWorkflowRequest)(request), (error) => {
                node_assert_1.default.ok(error instanceof validation_1.ValidationError);
                node_assert_1.default.ok(error.errors.some((e) => e.path === '/name'));
                return true;
            });
        });
        (0, node_test_1.it)('should reject request without organizationId', () => {
            const request = {
                name: 'Test Workflow'
            };
            node_assert_1.default.throws(() => (0, validation_1.validateCreateWorkflowRequest)(request), (error) => {
                node_assert_1.default.ok(error instanceof validation_1.ValidationError);
                node_assert_1.default.ok(error.errors.some((e) => e.path === '/organizationId'));
                return true;
            });
        });
        (0, node_test_1.it)('should reject request with empty name', () => {
            const request = {
                name: '',
                organizationId: 'org-123'
            };
            node_assert_1.default.throws(() => (0, validation_1.validateCreateWorkflowRequest)(request), (error) => {
                node_assert_1.default.ok(error instanceof validation_1.ValidationError);
                node_assert_1.default.ok(error.errors.some((e) => e.path === '/name'));
                return true;
            });
        });
        (0, node_test_1.it)('should reject request with name exceeding 200 characters', () => {
            const request = {
                name: 'a'.repeat(201),
                organizationId: 'org-123'
            };
            node_assert_1.default.throws(() => (0, validation_1.validateCreateWorkflowRequest)(request), (error) => {
                node_assert_1.default.ok(error instanceof validation_1.ValidationError);
                node_assert_1.default.ok(error.errors.some((e) => e.path === '/name'));
                return true;
            });
        });
        (0, node_test_1.it)('should reject null request body', () => {
            node_assert_1.default.throws(() => (0, validation_1.validateCreateWorkflowRequest)(null), (error) => {
                node_assert_1.default.ok(error instanceof validation_1.ValidationError);
                return true;
            });
        });
        (0, node_test_1.it)('should reject non-object request body', () => {
            node_assert_1.default.throws(() => (0, validation_1.validateCreateWorkflowRequest)('invalid'), (error) => {
                node_assert_1.default.ok(error instanceof validation_1.ValidationError);
                return true;
            });
        });
        (0, node_test_1.it)('should reject invalid triggers type', () => {
            const request = {
                name: 'Test',
                organizationId: 'org-123',
                triggers: 'not-an-array'
            };
            node_assert_1.default.throws(() => (0, validation_1.validateCreateWorkflowRequest)(request), (error) => {
                node_assert_1.default.ok(error instanceof validation_1.ValidationError);
                node_assert_1.default.ok(error.errors.some((e) => e.path === '/triggers'));
                return true;
            });
        });
        (0, node_test_1.it)('should reject invalid steps type', () => {
            const request = {
                name: 'Test',
                organizationId: 'org-123',
                steps: 'not-an-array'
            };
            node_assert_1.default.throws(() => (0, validation_1.validateCreateWorkflowRequest)(request), (error) => {
                node_assert_1.default.ok(error instanceof validation_1.ValidationError);
                node_assert_1.default.ok(error.errors.some((e) => e.path === '/steps'));
                return true;
            });
        });
    });
    (0, node_test_1.describe)('validateUpdateWorkflowRequest', () => {
        (0, node_test_1.it)('should validate a valid update request', () => {
            const request = {
                name: 'Updated Workflow',
                description: 'Updated description'
            };
            const result = (0, validation_1.validateUpdateWorkflowRequest)(request);
            node_assert_1.default.strictEqual(result.name, 'Updated Workflow');
            node_assert_1.default.strictEqual(result.description, 'Updated description');
        });
        (0, node_test_1.it)('should validate empty update request (no changes)', () => {
            const request = {};
            const result = (0, validation_1.validateUpdateWorkflowRequest)(request);
            node_assert_1.default.deepStrictEqual(result, {});
        });
        (0, node_test_1.it)('should reject update with empty name', () => {
            const request = {
                name: ''
            };
            node_assert_1.default.throws(() => (0, validation_1.validateUpdateWorkflowRequest)(request), (error) => {
                node_assert_1.default.ok(error instanceof validation_1.ValidationError);
                node_assert_1.default.ok(error.errors.some((e) => e.path === '/name'));
                return true;
            });
        });
        (0, node_test_1.it)('should reject update with name exceeding 200 characters', () => {
            const request = {
                name: 'a'.repeat(201)
            };
            node_assert_1.default.throws(() => (0, validation_1.validateUpdateWorkflowRequest)(request), (error) => {
                node_assert_1.default.ok(error instanceof validation_1.ValidationError);
                node_assert_1.default.ok(error.errors.some((e) => e.path === '/name'));
                return true;
            });
        });
    });
    (0, node_test_1.describe)('validateAddStepRequest', () => {
        (0, node_test_1.it)('should validate a valid add step request', () => {
            const request = {
                step: {
                    name: 'New Step',
                    type: 'action',
                    order: 1
                }
            };
            const result = (0, validation_1.validateAddStepRequest)(request);
            node_assert_1.default.strictEqual(result.step.name, 'New Step');
            node_assert_1.default.strictEqual(result.step.type, 'action');
        });
        (0, node_test_1.it)('should validate add step request with afterStepId', () => {
            const request = {
                step: {
                    name: 'New Step',
                    type: 'action',
                    order: 1
                },
                afterStepId: 'step-1'
            };
            const result = (0, validation_1.validateAddStepRequest)(request);
            node_assert_1.default.strictEqual(result.afterStepId, 'step-1');
        });
        (0, node_test_1.it)('should reject request without step', () => {
            const request = {};
            node_assert_1.default.throws(() => (0, validation_1.validateAddStepRequest)(request), (error) => {
                node_assert_1.default.ok(error instanceof validation_1.ValidationError);
                node_assert_1.default.ok(error.errors.some((e) => e.path === '/step'));
                return true;
            });
        });
        (0, node_test_1.it)('should reject step without name', () => {
            const request = {
                step: {
                    type: 'action',
                    order: 1
                }
            };
            node_assert_1.default.throws(() => (0, validation_1.validateAddStepRequest)(request), (error) => {
                node_assert_1.default.ok(error instanceof validation_1.ValidationError);
                node_assert_1.default.ok(error.errors.some((e) => e.path === '/step/name'));
                return true;
            });
        });
        (0, node_test_1.it)('should reject step without type', () => {
            const request = {
                step: {
                    name: 'Test Step',
                    order: 1
                }
            };
            node_assert_1.default.throws(() => (0, validation_1.validateAddStepRequest)(request), (error) => {
                node_assert_1.default.ok(error instanceof validation_1.ValidationError);
                node_assert_1.default.ok(error.errors.some((e) => e.path === '/step/type'));
                return true;
            });
        });
        (0, node_test_1.it)('should reject invalid afterStepId type', () => {
            const request = {
                step: {
                    name: 'Test Step',
                    type: 'action',
                    order: 1
                },
                afterStepId: 123
            };
            node_assert_1.default.throws(() => (0, validation_1.validateAddStepRequest)(request), (error) => {
                node_assert_1.default.ok(error instanceof validation_1.ValidationError);
                node_assert_1.default.ok(error.errors.some((e) => e.path === '/afterStepId'));
                return true;
            });
        });
    });
    (0, node_test_1.describe)('validateWorkflowSteps', () => {
        (0, node_test_1.it)('should validate valid steps', () => {
            const steps = [
                {
                    id: 'step-1',
                    name: 'Step 1',
                    type: 'action',
                    order: 1,
                    action: {
                        type: 'http_request',
                        config: { url: 'https://api.example.com', method: 'GET' }
                    }
                },
                {
                    id: 'step-2',
                    name: 'Step 2',
                    type: 'terminate',
                    order: 2
                }
            ];
            const result = (0, validation_1.validateWorkflowSteps)(steps);
            node_assert_1.default.strictEqual(result.valid, true);
            node_assert_1.default.strictEqual(result.errors.length, 0);
        });
        (0, node_test_1.it)('should detect duplicate step IDs', () => {
            const steps = [
                {
                    id: 'step-1',
                    name: 'Step 1',
                    type: 'terminate',
                    order: 1
                },
                {
                    id: 'step-1',
                    name: 'Step 2',
                    type: 'terminate',
                    order: 2
                }
            ];
            const result = (0, validation_1.validateWorkflowSteps)(steps);
            node_assert_1.default.strictEqual(result.valid, false);
            node_assert_1.default.ok(result.errors.some((e) => e.message.includes('Duplicate step ID')));
        });
        (0, node_test_1.it)('should require action config for action steps', () => {
            const steps = [
                {
                    id: 'step-1',
                    name: 'Step 1',
                    type: 'action',
                    order: 1
                    // Missing action
                }
            ];
            const result = (0, validation_1.validateWorkflowSteps)(steps);
            node_assert_1.default.strictEqual(result.valid, false);
            node_assert_1.default.ok(result.errors.some((e) => e.message.includes('Action configuration is required')));
        });
        (0, node_test_1.it)('should require conditions for decision steps', () => {
            const steps = [
                {
                    id: 'step-1',
                    name: 'Step 1',
                    type: 'decision',
                    order: 1
                    // Missing conditions
                }
            ];
            const result = (0, validation_1.validateWorkflowSteps)(steps);
            node_assert_1.default.strictEqual(result.valid, false);
            node_assert_1.default.ok(result.errors.some((e) => e.message.includes('Conditions are required')));
        });
        (0, node_test_1.it)('should require parallelConfig for parallel steps', () => {
            const steps = [
                {
                    id: 'step-1',
                    name: 'Step 1',
                    type: 'parallel',
                    order: 1
                    // Missing parallelConfig
                }
            ];
            const result = (0, validation_1.validateWorkflowSteps)(steps);
            node_assert_1.default.strictEqual(result.valid, false);
            node_assert_1.default.ok(result.errors.some((e) => e.message.includes('Parallel configuration')));
        });
        (0, node_test_1.it)('should require waitConfig for wait steps', () => {
            const steps = [
                {
                    id: 'step-1',
                    name: 'Step 1',
                    type: 'wait',
                    order: 1
                    // Missing waitConfig
                }
            ];
            const result = (0, validation_1.validateWorkflowSteps)(steps);
            node_assert_1.default.strictEqual(result.valid, false);
            node_assert_1.default.ok(result.errors.some((e) => e.message.includes('Wait configuration is required')));
        });
        (0, node_test_1.it)('should require loopConfig for loop steps', () => {
            const steps = [
                {
                    id: 'step-1',
                    name: 'Step 1',
                    type: 'loop',
                    order: 1
                    // Missing loopConfig
                }
            ];
            const result = (0, validation_1.validateWorkflowSteps)(steps);
            node_assert_1.default.strictEqual(result.valid, false);
            node_assert_1.default.ok(result.errors.some((e) => e.message.includes('Loop configuration is required')));
        });
        (0, node_test_1.it)('should require subworkflowConfig for subworkflow steps', () => {
            const steps = [
                {
                    id: 'step-1',
                    name: 'Step 1',
                    type: 'subworkflow',
                    order: 1
                    // Missing subworkflowConfig
                }
            ];
            const result = (0, validation_1.validateWorkflowSteps)(steps);
            node_assert_1.default.strictEqual(result.valid, false);
            node_assert_1.default.ok(result.errors.some((e) => e.message.includes('Subworkflow configuration')));
        });
        (0, node_test_1.it)('should require transformConfig for transform steps', () => {
            const steps = [
                {
                    id: 'step-1',
                    name: 'Step 1',
                    type: 'transform',
                    order: 1
                    // Missing transformConfig
                }
            ];
            const result = (0, validation_1.validateWorkflowSteps)(steps);
            node_assert_1.default.strictEqual(result.valid, false);
            node_assert_1.default.ok(result.errors.some((e) => e.message.includes('Transform configuration is required')));
        });
        (0, node_test_1.it)('should require scriptConfig for script steps', () => {
            const steps = [
                {
                    id: 'step-1',
                    name: 'Step 1',
                    type: 'script',
                    order: 1
                    // Missing scriptConfig
                }
            ];
            const result = (0, validation_1.validateWorkflowSteps)(steps);
            node_assert_1.default.strictEqual(result.valid, false);
            node_assert_1.default.ok(result.errors.some((e) => e.message.includes('Script configuration')));
        });
        (0, node_test_1.it)('should require valid delaySeconds for delay steps', () => {
            const steps = [
                {
                    id: 'step-1',
                    name: 'Step 1',
                    type: 'delay',
                    order: 1
                    // Missing delaySeconds
                }
            ];
            const result = (0, validation_1.validateWorkflowSteps)(steps);
            node_assert_1.default.strictEqual(result.valid, false);
            node_assert_1.default.ok(result.errors.some((e) => e.message.includes('Valid delaySeconds is required')));
        });
        (0, node_test_1.it)('should detect invalid transition targets', () => {
            const steps = [
                {
                    id: 'step-1',
                    name: 'Step 1',
                    type: 'action',
                    order: 1,
                    action: {
                        type: 'http_request',
                        config: { url: 'https://api.example.com', method: 'GET' }
                    },
                    transitions: [{ targetStepId: 'non-existent-step' }]
                }
            ];
            const result = (0, validation_1.validateWorkflowSteps)(steps);
            node_assert_1.default.strictEqual(result.valid, false);
            node_assert_1.default.ok(result.errors.some((e) => e.message.includes('Invalid transition target')));
        });
        (0, node_test_1.it)('should validate valid transitions', () => {
            const steps = [
                {
                    id: 'step-1',
                    name: 'Step 1',
                    type: 'action',
                    order: 1,
                    action: {
                        type: 'http_request',
                        config: { url: 'https://api.example.com', method: 'GET' }
                    },
                    transitions: [{ targetStepId: 'step-2' }]
                },
                {
                    id: 'step-2',
                    name: 'Step 2',
                    type: 'terminate',
                    order: 2
                }
            ];
            const result = (0, validation_1.validateWorkflowSteps)(steps);
            node_assert_1.default.strictEqual(result.valid, true);
        });
    });
    (0, node_test_1.describe)('validateWorkflowIntegrity', () => {
        (0, node_test_1.it)('should validate a workflow with terminate step', () => {
            const workflow = {
                id: 'doc-1',
                workflowId: 'wf-1',
                name: 'Test Workflow',
                version: 1,
                status: 'draft',
                organizationId: 'org-123',
                triggers: [],
                steps: [
                    {
                        id: 'step-1',
                        name: 'Step 1',
                        type: 'action',
                        order: 1,
                        action: {
                            type: 'http_request',
                            config: { url: 'https://api.example.com', method: 'GET' }
                        }
                    },
                    {
                        id: 'step-2',
                        name: 'End',
                        type: 'terminate',
                        order: 2
                    }
                ],
                createdAt: new Date().toISOString(),
                createdBy: 'user-1'
            };
            const result = (0, validation_1.validateWorkflowIntegrity)(workflow);
            node_assert_1.default.strictEqual(result.valid, true);
        });
        (0, node_test_1.it)('should validate a workflow with implicit end (no transitions on last step)', () => {
            const workflow = {
                id: 'doc-1',
                workflowId: 'wf-1',
                name: 'Test Workflow',
                version: 1,
                status: 'draft',
                organizationId: 'org-123',
                triggers: [],
                steps: [
                    {
                        id: 'step-1',
                        name: 'Step 1',
                        type: 'action',
                        order: 1,
                        action: {
                            type: 'http_request',
                            config: { url: 'https://api.example.com', method: 'GET' }
                        }
                    }
                ],
                createdAt: new Date().toISOString(),
                createdBy: 'user-1'
            };
            const result = (0, validation_1.validateWorkflowIntegrity)(workflow);
            node_assert_1.default.strictEqual(result.valid, true);
        });
        (0, node_test_1.it)('should detect duplicate trigger IDs', () => {
            const workflow = {
                id: 'doc-1',
                workflowId: 'wf-1',
                name: 'Test Workflow',
                version: 1,
                status: 'draft',
                organizationId: 'org-123',
                triggers: [
                    { id: 'trigger-1', type: 'manual', config: {} },
                    { id: 'trigger-1', type: 'http', config: { method: 'POST' } }
                ],
                steps: [
                    {
                        id: 'step-1',
                        name: 'End',
                        type: 'terminate',
                        order: 1
                    }
                ],
                createdAt: new Date().toISOString(),
                createdBy: 'user-1'
            };
            const result = (0, validation_1.validateWorkflowIntegrity)(workflow);
            node_assert_1.default.strictEqual(result.valid, false);
            node_assert_1.default.ok(result.errors.some((e) => e.message.includes('Duplicate trigger ID')));
        });
        (0, node_test_1.it)('should pass step validation errors through', () => {
            const workflow = {
                id: 'doc-1',
                workflowId: 'wf-1',
                name: 'Test Workflow',
                version: 1,
                status: 'draft',
                organizationId: 'org-123',
                triggers: [],
                steps: [
                    {
                        id: 'step-1',
                        name: 'Step 1',
                        type: 'action',
                        order: 1
                        // Missing action config
                    }
                ],
                createdAt: new Date().toISOString(),
                createdBy: 'user-1'
            };
            const result = (0, validation_1.validateWorkflowIntegrity)(workflow);
            node_assert_1.default.strictEqual(result.valid, false);
            node_assert_1.default.ok(result.errors.some((e) => e.message.includes('Action configuration is required')));
        });
        (0, node_test_1.it)('should handle empty steps array', () => {
            const workflow = {
                id: 'doc-1',
                workflowId: 'wf-1',
                name: 'Test Workflow',
                version: 1,
                status: 'draft',
                organizationId: 'org-123',
                triggers: [],
                steps: [],
                createdAt: new Date().toISOString(),
                createdBy: 'user-1'
            };
            const result = (0, validation_1.validateWorkflowIntegrity)(workflow);
            node_assert_1.default.strictEqual(result.valid, true);
        });
    });
});
//# sourceMappingURL=validation.test.js.map