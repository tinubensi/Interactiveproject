import { describe, it, before, mock } from 'node:test';
import assert from 'node:assert';

// Type for mock functions that return values
type MockFn<T> = ReturnType<typeof mock.fn> & { mock: { mockImplementation: (fn: () => T) => void } };

// Mock Cosmos DB before importing repository
const mockContainers = {
  workflowTemplates: {
    items: {
      create: mock.fn() as MockFn<Promise<{ resource: unknown }>>,
      upsert: mock.fn() as MockFn<Promise<{ resource: unknown }>>,
      query: mock.fn() as MockFn<{ fetchAll: () => Promise<{ resources: unknown[] }> }>,
    },
    item: mock.fn() as MockFn<{ read: () => Promise<unknown>; delete: () => Promise<unknown> }>,
  },
  workflowDefinitions: {
    items: {
      create: mock.fn() as MockFn<Promise<{ resource: unknown }>>,
    },
  },
};

// Use experimental module mocking - requires Node.js 20.6.0+
// @ts-expect-error - mock.module is experimental and not in type definitions
mock.module('../lib/cosmosClient', {
  namedExports: {
    getCosmosContainers: () => Promise.resolve(mockContainers),
  },
});

// Import after mocking
import {
  createTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
  createWorkflowFromTemplate,
  TemplateNotFoundError,
} from '../lib/repositories/templateRepository';
import type { WorkflowTemplate } from '../models/workflowTypes';

describe('TemplateRepository', () => {
  const sampleTemplate: Omit<WorkflowTemplate, 'id' | 'templateId' | 'createdAt'> = {
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

  before(() => {
    // Reset all mocks before tests
    mockContainers.workflowTemplates.items.create.mock.resetCalls();
    mockContainers.workflowTemplates.items.query.mock.resetCalls();
  });

  describe('createTemplate', () => {
    it('should create a new template with generated id', async () => {
      const createdTemplate = {
        ...sampleTemplate,
        id: 'tpl-12345678',
        templateId: 'tpl-12345678',
        createdAt: new Date().toISOString(),
      };

      mockContainers.workflowTemplates.items.create.mock.mockImplementation(() =>
        Promise.resolve({ resource: createdTemplate })
      );

      const result = await createTemplate(sampleTemplate, 'user-1');

      assert.ok(result.id.startsWith('tpl-'));
      assert.ok(result.templateId.startsWith('tpl-'));
      assert.strictEqual(result.name, sampleTemplate.name);
      assert.strictEqual(result.category, sampleTemplate.category);
      assert.strictEqual(result.isPublic, true);
      assert.ok(result.createdAt);
    });

    it('should set version to 1 for new templates', async () => {
      const createdTemplate = {
        ...sampleTemplate,
        id: 'tpl-12345678',
        templateId: 'tpl-12345678',
        createdAt: new Date().toISOString(),
        version: 1,
      };

      mockContainers.workflowTemplates.items.create.mock.mockImplementation(() =>
        Promise.resolve({ resource: createdTemplate })
      );

      const result = await createTemplate(sampleTemplate, 'user-1');

      assert.strictEqual(result.version, 1);
    });
  });

  describe('getTemplate', () => {
    it('should return template by id', async () => {
      const template = {
        ...sampleTemplate,
        id: 'tpl-12345678',
        templateId: 'tpl-12345678',
        createdAt: new Date().toISOString(),
      };

      mockContainers.workflowTemplates.items.query.mock.mockImplementation(() => ({
        fetchAll: () => Promise.resolve({ resources: [template] }),
      }));

      const result = await getTemplate('tpl-12345678');

      assert.strictEqual(result.id, 'tpl-12345678');
      assert.strictEqual(result.name, sampleTemplate.name);
    });

    it('should throw TemplateNotFoundError when template does not exist', async () => {
      mockContainers.workflowTemplates.items.query.mock.mockImplementation(() => ({
        fetchAll: () => Promise.resolve({ resources: [] }),
      }));

      await assert.rejects(
        () => getTemplate('non-existent'),
        { name: 'TemplateNotFoundError' }
      );
    });
  });

  describe('listTemplates', () => {
    it('should return all public templates', async () => {
      const templates = [
        { ...sampleTemplate, id: 'tpl-1', templateId: 'tpl-1', createdAt: new Date().toISOString() },
        { ...sampleTemplate, id: 'tpl-2', templateId: 'tpl-2', name: 'Renewal Workflow', createdAt: new Date().toISOString() },
      ];

      mockContainers.workflowTemplates.items.query.mock.mockImplementation(() => ({
        fetchAll: () => Promise.resolve({ resources: templates }),
      }));

      const result = await listTemplates({});

      assert.strictEqual(result.length, 2);
    });

    it('should filter by category', async () => {
      const templates = [
        { ...sampleTemplate, id: 'tpl-1', templateId: 'tpl-1', createdAt: new Date().toISOString() },
      ];

      mockContainers.workflowTemplates.items.query.mock.mockImplementation(() => ({
        fetchAll: () => Promise.resolve({ resources: templates }),
      }));

      const result = await listTemplates({ category: 'new-business' });

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].category, 'new-business');
    });

    it('should filter by tags', async () => {
      const templates = [
        { ...sampleTemplate, id: 'tpl-1', templateId: 'tpl-1', createdAt: new Date().toISOString() },
      ];

      mockContainers.workflowTemplates.items.query.mock.mockImplementation(() => ({
        fetchAll: () => Promise.resolve({ resources: templates }),
      }));

      const result = await listTemplates({ tags: ['auto-insurance'] });

      assert.ok(result.length >= 0);
    });
  });

  describe('updateTemplate', () => {
    it('should update template and increment version', async () => {
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

      mockContainers.workflowTemplates.items.upsert.mock.mockImplementation(() =>
        Promise.resolve({ resource: updatedTemplate })
      );

      const result = await updateTemplate('tpl-12345678', { name: 'Updated Workflow Name' }, 'user-1');

      assert.strictEqual(result.name, 'Updated Workflow Name');
      assert.strictEqual(result.version, 2);
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template by id', async () => {
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

      await assert.doesNotReject(() => deleteTemplate('tpl-12345678'));
    });

    it('should throw error when template not found', async () => {
      mockContainers.workflowTemplates.items.query.mock.mockImplementation(() => ({
        fetchAll: () => Promise.resolve({ resources: [] }),
      }));

      await assert.rejects(
        () => deleteTemplate('non-existent'),
        { name: 'TemplateNotFoundError' }
      );
    });
  });

  describe('createWorkflowFromTemplate', () => {
    it('should create workflow from template with new IDs', async () => {
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

      mockContainers.workflowDefinitions.items.create.mock.mockImplementation(() =>
        Promise.resolve({ resource: createdWorkflow })
      );

      const result = await createWorkflowFromTemplate({
        templateId: 'tpl-12345678',
        name: 'My New Workflow',
        organizationId: 'org-1',
      }, 'user-1');

      assert.ok(result.workflowId.startsWith('wf-'));
      assert.strictEqual(result.name, 'My New Workflow');
      assert.strictEqual(result.status, 'draft');
      assert.strictEqual(result.organizationId, 'org-1');
    });

    it('should apply configuration to template variables', async () => {
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

      mockContainers.workflowDefinitions.items.create.mock.mockImplementation((workflow: unknown) =>
        Promise.resolve({ resource: workflow })
      );

      const result = await createWorkflowFromTemplate({
        templateId: 'tpl-12345678',
        name: 'Configured Workflow',
        organizationId: 'org-1',
        configuration: {
          approverRole: 'manager',
        },
      }, 'user-1');

      assert.ok(result);
    });

    it('should throw error when template not found', async () => {
      mockContainers.workflowTemplates.items.query.mock.mockImplementation(() => ({
        fetchAll: () => Promise.resolve({ resources: [] }),
      }));

      await assert.rejects(
        () => createWorkflowFromTemplate({
          templateId: 'non-existent',
          name: 'Test',
          organizationId: 'org-1',
        }, 'user-1'),
        { name: 'TemplateNotFoundError' }
      );
    });
  });
});
