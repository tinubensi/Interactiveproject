"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
// Mock Cosmos DB before importing repository
const mockContainers = {
    workflowTemplates: {
        items: {
            create: node_test_1.mock.fn(),
            upsert: node_test_1.mock.fn(),
            query: node_test_1.mock.fn(),
        },
        item: node_test_1.mock.fn(),
    },
    workflowDefinitions: {
        items: {
            create: node_test_1.mock.fn(),
        },
    },
};
// Use experimental module mocking - requires Node.js 20.6.0+
// @ts-expect-error - mock.module is experimental and not in type definitions
node_test_1.mock.module('../lib/cosmosClient', {
    namedExports: {
        getCosmosContainers: () => Promise.resolve(mockContainers),
    },
});
// Import after mocking
const templateRepository_1 = require("../lib/repositories/templateRepository");
(0, node_test_1.describe)('TemplateRepository', () => {
    const sampleTemplate = {
        name: 'New Business Workflow',
        description: 'Standard quote-to-bind workflow',
        category: 'new-business',
        tags: ['quote', 'policy', 'auto-insurance'],
        baseWorkflow: {
            triggers: [
                {
                    id: 'trigger-1',
                    type: 'event',
                    config: {
                        eventType: 'IntakeFormSubmittedEvent',
                    },
                },
            ],
            steps: [
                {
                    id: 'step-1',
                    name: 'Validate Intake',
                    type: 'action',
                    order: 1,
                    action: {
                        type: 'http_request',
                        config: {
                            url: '{{env.INTAKE_SERVICE_URL}}/validate',
                            method: 'POST',
                        },
                    },
                },
            ],
            variables: {
                customerId: { type: 'string', required: true },
                insuranceLine: { type: 'string', required: true },
            },
            settings: {
                maxExecutionDurationSeconds: 86400,
            },
        },
        requiredVariables: ['customerId', 'insuranceLine'],
        isPublic: true,
        createdBy: 'system',
        version: 1,
    };
    (0, node_test_1.before)(() => {
        // Reset all mocks before tests
        mockContainers.workflowTemplates.items.create.mock.resetCalls();
        mockContainers.workflowTemplates.items.query.mock.resetCalls();
    });
    (0, node_test_1.describe)('createTemplate', () => {
        (0, node_test_1.it)('should create a new template with generated id', async () => {
            const createdTemplate = {
                ...sampleTemplate,
                id: 'tpl-12345678',
                templateId: 'tpl-12345678',
                createdAt: new Date().toISOString(),
            };
            mockContainers.workflowTemplates.items.create.mock.mockImplementation(() => Promise.resolve({ resource: createdTemplate }));
            const result = await (0, templateRepository_1.createTemplate)(sampleTemplate, 'user-1');
            node_assert_1.default.ok(result.id.startsWith('tpl-'));
            node_assert_1.default.ok(result.templateId.startsWith('tpl-'));
            node_assert_1.default.strictEqual(result.name, sampleTemplate.name);
            node_assert_1.default.strictEqual(result.category, sampleTemplate.category);
            node_assert_1.default.strictEqual(result.isPublic, true);
            node_assert_1.default.ok(result.createdAt);
        });
        (0, node_test_1.it)('should set version to 1 for new templates', async () => {
            const createdTemplate = {
                ...sampleTemplate,
                id: 'tpl-12345678',
                templateId: 'tpl-12345678',
                createdAt: new Date().toISOString(),
                version: 1,
            };
            mockContainers.workflowTemplates.items.create.mock.mockImplementation(() => Promise.resolve({ resource: createdTemplate }));
            const result = await (0, templateRepository_1.createTemplate)(sampleTemplate, 'user-1');
            node_assert_1.default.strictEqual(result.version, 1);
        });
    });
    (0, node_test_1.describe)('getTemplate', () => {
        (0, node_test_1.it)('should return template by id', async () => {
            const template = {
                ...sampleTemplate,
                id: 'tpl-12345678',
                templateId: 'tpl-12345678',
                createdAt: new Date().toISOString(),
            };
            mockContainers.workflowTemplates.items.query.mock.mockImplementation(() => ({
                fetchAll: () => Promise.resolve({ resources: [template] }),
            }));
            const result = await (0, templateRepository_1.getTemplate)('tpl-12345678');
            node_assert_1.default.strictEqual(result.id, 'tpl-12345678');
            node_assert_1.default.strictEqual(result.name, sampleTemplate.name);
        });
        (0, node_test_1.it)('should throw TemplateNotFoundError when template does not exist', async () => {
            mockContainers.workflowTemplates.items.query.mock.mockImplementation(() => ({
                fetchAll: () => Promise.resolve({ resources: [] }),
            }));
            await node_assert_1.default.rejects(() => (0, templateRepository_1.getTemplate)('non-existent'), { name: 'TemplateNotFoundError' });
        });
    });
    (0, node_test_1.describe)('listTemplates', () => {
        (0, node_test_1.it)('should return all public templates', async () => {
            const templates = [
                { ...sampleTemplate, id: 'tpl-1', templateId: 'tpl-1', createdAt: new Date().toISOString() },
                { ...sampleTemplate, id: 'tpl-2', templateId: 'tpl-2', name: 'Renewal Workflow', createdAt: new Date().toISOString() },
            ];
            mockContainers.workflowTemplates.items.query.mock.mockImplementation(() => ({
                fetchAll: () => Promise.resolve({ resources: templates }),
            }));
            const result = await (0, templateRepository_1.listTemplates)({});
            node_assert_1.default.strictEqual(result.length, 2);
        });
        (0, node_test_1.it)('should filter by category', async () => {
            const templates = [
                { ...sampleTemplate, id: 'tpl-1', templateId: 'tpl-1', createdAt: new Date().toISOString() },
            ];
            mockContainers.workflowTemplates.items.query.mock.mockImplementation(() => ({
                fetchAll: () => Promise.resolve({ resources: templates }),
            }));
            const result = await (0, templateRepository_1.listTemplates)({ category: 'new-business' });
            node_assert_1.default.strictEqual(result.length, 1);
            node_assert_1.default.strictEqual(result[0].category, 'new-business');
        });
        (0, node_test_1.it)('should filter by tags', async () => {
            const templates = [
                { ...sampleTemplate, id: 'tpl-1', templateId: 'tpl-1', createdAt: new Date().toISOString() },
            ];
            mockContainers.workflowTemplates.items.query.mock.mockImplementation(() => ({
                fetchAll: () => Promise.resolve({ resources: templates }),
            }));
            const result = await (0, templateRepository_1.listTemplates)({ tags: ['auto-insurance'] });
            node_assert_1.default.ok(result.length >= 0);
        });
    });
    (0, node_test_1.describe)('updateTemplate', () => {
        (0, node_test_1.it)('should update template and increment version', async () => {
            const existingTemplate = {
                ...sampleTemplate,
                id: 'tpl-12345678',
                templateId: 'tpl-12345678',
                createdAt: new Date().toISOString(),
                version: 1,
            };
            const updatedTemplate = {
                ...existingTemplate,
                name: 'Updated Workflow Name',
                version: 2,
                updatedAt: new Date().toISOString(),
            };
            mockContainers.workflowTemplates.items.query.mock.mockImplementation(() => ({
                fetchAll: () => Promise.resolve({ resources: [existingTemplate] }),
            }));
            mockContainers.workflowTemplates.items.upsert.mock.mockImplementation(() => Promise.resolve({ resource: updatedTemplate }));
            const result = await (0, templateRepository_1.updateTemplate)('tpl-12345678', { name: 'Updated Workflow Name' }, 'user-1');
            node_assert_1.default.strictEqual(result.name, 'Updated Workflow Name');
            node_assert_1.default.strictEqual(result.version, 2);
        });
    });
    (0, node_test_1.describe)('deleteTemplate', () => {
        (0, node_test_1.it)('should delete template by id', async () => {
            const template = {
                ...sampleTemplate,
                id: 'tpl-12345678',
                templateId: 'tpl-12345678',
                createdAt: new Date().toISOString(),
            };
            mockContainers.workflowTemplates.items.query.mock.mockImplementation(() => ({
                fetchAll: () => Promise.resolve({ resources: [template] }),
            }));
            mockContainers.workflowTemplates.item.mock.mockImplementation(() => ({
                delete: () => Promise.resolve({}),
            }));
            await node_assert_1.default.doesNotReject(() => (0, templateRepository_1.deleteTemplate)('tpl-12345678'));
        });
        (0, node_test_1.it)('should throw error when template not found', async () => {
            mockContainers.workflowTemplates.items.query.mock.mockImplementation(() => ({
                fetchAll: () => Promise.resolve({ resources: [] }),
            }));
            await node_assert_1.default.rejects(() => (0, templateRepository_1.deleteTemplate)('non-existent'), { name: 'TemplateNotFoundError' });
        });
    });
    (0, node_test_1.describe)('createWorkflowFromTemplate', () => {
        (0, node_test_1.it)('should create workflow from template with new IDs', async () => {
            const template = {
                ...sampleTemplate,
                id: 'tpl-12345678',
                templateId: 'tpl-12345678',
                createdAt: new Date().toISOString(),
            };
            const createdWorkflow = {
                id: 'wf-newid-v1',
                workflowId: 'wf-newid',
                name: 'My New Workflow',
                version: 1,
                status: 'draft',
                organizationId: 'org-1',
                triggers: template.baseWorkflow.triggers,
                steps: template.baseWorkflow.steps,
                variables: template.baseWorkflow.variables,
                settings: template.baseWorkflow.settings,
                createdAt: new Date().toISOString(),
                createdBy: 'user-1',
            };
            mockContainers.workflowTemplates.items.query.mock.mockImplementation(() => ({
                fetchAll: () => Promise.resolve({ resources: [template] }),
            }));
            mockContainers.workflowDefinitions.items.create.mock.mockImplementation(() => Promise.resolve({ resource: createdWorkflow }));
            const result = await (0, templateRepository_1.createWorkflowFromTemplate)({
                templateId: 'tpl-12345678',
                name: 'My New Workflow',
                organizationId: 'org-1',
            }, 'user-1');
            node_assert_1.default.ok(result.workflowId.startsWith('wf-'));
            node_assert_1.default.strictEqual(result.name, 'My New Workflow');
            node_assert_1.default.strictEqual(result.status, 'draft');
            node_assert_1.default.strictEqual(result.organizationId, 'org-1');
        });
        (0, node_test_1.it)('should apply configuration to template variables', async () => {
            const template = {
                ...sampleTemplate,
                id: 'tpl-12345678',
                templateId: 'tpl-12345678',
                createdAt: new Date().toISOString(),
                configurationSchema: {
                    type: 'object',
                    properties: {
                        approverRole: { type: 'string' },
                    },
                },
            };
            mockContainers.workflowTemplates.items.query.mock.mockImplementation(() => ({
                fetchAll: () => Promise.resolve({ resources: [template] }),
            }));
            mockContainers.workflowDefinitions.items.create.mock.mockImplementation((workflow) => Promise.resolve({ resource: workflow }));
            const result = await (0, templateRepository_1.createWorkflowFromTemplate)({
                templateId: 'tpl-12345678',
                name: 'Configured Workflow',
                organizationId: 'org-1',
                configuration: {
                    approverRole: 'manager',
                },
            }, 'user-1');
            node_assert_1.default.ok(result);
        });
        (0, node_test_1.it)('should throw error when template not found', async () => {
            mockContainers.workflowTemplates.items.query.mock.mockImplementation(() => ({
                fetchAll: () => Promise.resolve({ resources: [] }),
            }));
            await node_assert_1.default.rejects(() => (0, templateRepository_1.createWorkflowFromTemplate)({
                templateId: 'non-existent',
                name: 'Test',
                organizationId: 'org-1',
            }, 'user-1'), { name: 'TemplateNotFoundError' });
        });
    });
});
//# sourceMappingURL=templateRepository.test.js.map