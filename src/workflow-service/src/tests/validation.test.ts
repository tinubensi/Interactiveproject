import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  validateWorkflowDefinition,
  validateCreateWorkflowRequest,
  validateUpdateWorkflowRequest,
  validateAddStepRequest,
  validateWorkflowSteps,
  validateWorkflowIntegrity,
  ValidationError
} from '../lib/validation';
import {
  WorkflowDefinition,
  WorkflowStep,
  CreateWorkflowRequest
} from '../models/workflowTypes';

describe('Validation Module', () => {
  describe('validateCreateWorkflowRequest', () => {
    it('should validate a valid create workflow request', () => {
      const request: CreateWorkflowRequest = {
        name: 'Test Workflow',
        organizationId: 'org-123'
      };

      const result = validateCreateWorkflowRequest(request);

      assert.strictEqual(result.name, 'Test Workflow');
      assert.strictEqual(result.organizationId, 'org-123');
    });

    it('should validate request with all optional fields', () => {
      const request: CreateWorkflowRequest = {
        name: 'Test Workflow',
        organizationId: 'org-123',
        description: 'A test workflow',
        triggers: [],
        steps: [],
        tags: ['test'],
        category: 'testing'
      };

      const result = validateCreateWorkflowRequest(request);

      assert.strictEqual(result.description, 'A test workflow');
      assert.deepStrictEqual(result.triggers, []);
      assert.deepStrictEqual(result.steps, []);
      assert.deepStrictEqual(result.tags, ['test']);
      assert.strictEqual(result.category, 'testing');
    });

    it('should reject request without name', () => {
      const request = {
        organizationId: 'org-123'
      };

      assert.throws(
        () => validateCreateWorkflowRequest(request),
        (error: unknown) => {
          assert.ok(error instanceof ValidationError);
          assert.ok(error.errors.some((e) => e.path === '/name'));
          return true;
        }
      );
    });

    it('should reject request without organizationId', () => {
      const request = {
        name: 'Test Workflow'
      };

      assert.throws(
        () => validateCreateWorkflowRequest(request),
        (error: unknown) => {
          assert.ok(error instanceof ValidationError);
          assert.ok(error.errors.some((e) => e.path === '/organizationId'));
          return true;
        }
      );
    });

    it('should reject request with empty name', () => {
      const request = {
        name: '',
        organizationId: 'org-123'
      };

      assert.throws(
        () => validateCreateWorkflowRequest(request),
        (error: unknown) => {
          assert.ok(error instanceof ValidationError);
          assert.ok(error.errors.some((e) => e.path === '/name'));
          return true;
        }
      );
    });

    it('should reject request with name exceeding 200 characters', () => {
      const request = {
        name: 'a'.repeat(201),
        organizationId: 'org-123'
      };

      assert.throws(
        () => validateCreateWorkflowRequest(request),
        (error: unknown) => {
          assert.ok(error instanceof ValidationError);
          assert.ok(error.errors.some((e) => e.path === '/name'));
          return true;
        }
      );
    });

    it('should reject null request body', () => {
      assert.throws(
        () => validateCreateWorkflowRequest(null),
        (error: unknown) => {
          assert.ok(error instanceof ValidationError);
          return true;
        }
      );
    });

    it('should reject non-object request body', () => {
      assert.throws(
        () => validateCreateWorkflowRequest('invalid'),
        (error: unknown) => {
          assert.ok(error instanceof ValidationError);
          return true;
        }
      );
    });

    it('should reject invalid triggers type', () => {
      const request = {
        name: 'Test',
        organizationId: 'org-123',
        triggers: 'not-an-array'
      };

      assert.throws(
        () => validateCreateWorkflowRequest(request),
        (error: unknown) => {
          assert.ok(error instanceof ValidationError);
          assert.ok(error.errors.some((e) => e.path === '/triggers'));
          return true;
        }
      );
    });

    it('should reject invalid steps type', () => {
      const request = {
        name: 'Test',
        organizationId: 'org-123',
        steps: 'not-an-array'
      };

      assert.throws(
        () => validateCreateWorkflowRequest(request),
        (error: unknown) => {
          assert.ok(error instanceof ValidationError);
          assert.ok(error.errors.some((e) => e.path === '/steps'));
          return true;
        }
      );
    });
  });

  describe('validateUpdateWorkflowRequest', () => {
    it('should validate a valid update request', () => {
      const request = {
        name: 'Updated Workflow',
        description: 'Updated description'
      };

      const result = validateUpdateWorkflowRequest(request);

      assert.strictEqual(result.name, 'Updated Workflow');
      assert.strictEqual(result.description, 'Updated description');
    });

    it('should validate empty update request (no changes)', () => {
      const request = {};

      const result = validateUpdateWorkflowRequest(request);

      assert.deepStrictEqual(result, {});
    });

    it('should reject update with empty name', () => {
      const request = {
        name: ''
      };

      assert.throws(
        () => validateUpdateWorkflowRequest(request),
        (error: unknown) => {
          assert.ok(error instanceof ValidationError);
          assert.ok(error.errors.some((e) => e.path === '/name'));
          return true;
        }
      );
    });

    it('should reject update with name exceeding 200 characters', () => {
      const request = {
        name: 'a'.repeat(201)
      };

      assert.throws(
        () => validateUpdateWorkflowRequest(request),
        (error: unknown) => {
          assert.ok(error instanceof ValidationError);
          assert.ok(error.errors.some((e) => e.path === '/name'));
          return true;
        }
      );
    });
  });

  describe('validateAddStepRequest', () => {
    it('should validate a valid add step request', () => {
      const request = {
        step: {
          name: 'New Step',
          type: 'action',
          order: 1
        }
      };

      const result = validateAddStepRequest(request);

      assert.strictEqual(result.step.name, 'New Step');
      assert.strictEqual(result.step.type, 'action');
    });

    it('should validate add step request with afterStepId', () => {
      const request = {
        step: {
          name: 'New Step',
          type: 'action',
          order: 1
        },
        afterStepId: 'step-1'
      };

      const result = validateAddStepRequest(request);

      assert.strictEqual(result.afterStepId, 'step-1');
    });

    it('should reject request without step', () => {
      const request = {};

      assert.throws(
        () => validateAddStepRequest(request),
        (error: unknown) => {
          assert.ok(error instanceof ValidationError);
          assert.ok(error.errors.some((e) => e.path === '/step'));
          return true;
        }
      );
    });

    it('should reject step without name', () => {
      const request = {
        step: {
          type: 'action',
          order: 1
        }
      };

      assert.throws(
        () => validateAddStepRequest(request),
        (error: unknown) => {
          assert.ok(error instanceof ValidationError);
          assert.ok(error.errors.some((e) => e.path === '/step/name'));
          return true;
        }
      );
    });

    it('should reject step without type', () => {
      const request = {
        step: {
          name: 'Test Step',
          order: 1
        }
      };

      assert.throws(
        () => validateAddStepRequest(request),
        (error: unknown) => {
          assert.ok(error instanceof ValidationError);
          assert.ok(error.errors.some((e) => e.path === '/step/type'));
          return true;
        }
      );
    });

    it('should reject invalid afterStepId type', () => {
      const request = {
        step: {
          name: 'Test Step',
          type: 'action',
          order: 1
        },
        afterStepId: 123
      };

      assert.throws(
        () => validateAddStepRequest(request),
        (error: unknown) => {
          assert.ok(error instanceof ValidationError);
          assert.ok(error.errors.some((e) => e.path === '/afterStepId'));
          return true;
        }
      );
    });
  });

  describe('validateWorkflowSteps', () => {
    it('should validate valid steps', () => {
      const steps: WorkflowStep[] = [
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

      const result = validateWorkflowSteps(steps);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should detect duplicate step IDs', () => {
      const steps: WorkflowStep[] = [
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

      const result = validateWorkflowSteps(steps);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.message.includes('Duplicate step ID')));
    });

    it('should require action config for action steps', () => {
      const steps: WorkflowStep[] = [
        {
          id: 'step-1',
          name: 'Step 1',
          type: 'action',
          order: 1
          // Missing action
        }
      ];

      const result = validateWorkflowSteps(steps);

      assert.strictEqual(result.valid, false);
      assert.ok(
        result.errors.some((e) =>
          e.message.includes('Action configuration is required')
        )
      );
    });

    it('should require conditions for decision steps', () => {
      const steps: WorkflowStep[] = [
        {
          id: 'step-1',
          name: 'Step 1',
          type: 'decision',
          order: 1
          // Missing conditions
        }
      ];

      const result = validateWorkflowSteps(steps);

      assert.strictEqual(result.valid, false);
      assert.ok(
        result.errors.some((e) =>
          e.message.includes('Conditions are required')
        )
      );
    });

    it('should require parallelConfig for parallel steps', () => {
      const steps: WorkflowStep[] = [
        {
          id: 'step-1',
          name: 'Step 1',
          type: 'parallel',
          order: 1
          // Missing parallelConfig
        }
      ];

      const result = validateWorkflowSteps(steps);

      assert.strictEqual(result.valid, false);
      assert.ok(
        result.errors.some((e) =>
          e.message.includes('Parallel configuration')
        )
      );
    });

    it('should require waitConfig for wait steps', () => {
      const steps: WorkflowStep[] = [
        {
          id: 'step-1',
          name: 'Step 1',
          type: 'wait',
          order: 1
          // Missing waitConfig
        }
      ];

      const result = validateWorkflowSteps(steps);

      assert.strictEqual(result.valid, false);
      assert.ok(
        result.errors.some((e) =>
          e.message.includes('Wait configuration is required')
        )
      );
    });

    it('should require loopConfig for loop steps', () => {
      const steps: WorkflowStep[] = [
        {
          id: 'step-1',
          name: 'Step 1',
          type: 'loop',
          order: 1
          // Missing loopConfig
        }
      ];

      const result = validateWorkflowSteps(steps);

      assert.strictEqual(result.valid, false);
      assert.ok(
        result.errors.some((e) =>
          e.message.includes('Loop configuration is required')
        )
      );
    });

    it('should require subworkflowConfig for subworkflow steps', () => {
      const steps: WorkflowStep[] = [
        {
          id: 'step-1',
          name: 'Step 1',
          type: 'subworkflow',
          order: 1
          // Missing subworkflowConfig
        }
      ];

      const result = validateWorkflowSteps(steps);

      assert.strictEqual(result.valid, false);
      assert.ok(
        result.errors.some((e) =>
          e.message.includes('Subworkflow configuration')
        )
      );
    });

    it('should require transformConfig for transform steps', () => {
      const steps: WorkflowStep[] = [
        {
          id: 'step-1',
          name: 'Step 1',
          type: 'transform',
          order: 1
          // Missing transformConfig
        }
      ];

      const result = validateWorkflowSteps(steps);

      assert.strictEqual(result.valid, false);
      assert.ok(
        result.errors.some((e) =>
          e.message.includes('Transform configuration is required')
        )
      );
    });

    it('should require scriptConfig for script steps', () => {
      const steps: WorkflowStep[] = [
        {
          id: 'step-1',
          name: 'Step 1',
          type: 'script',
          order: 1
          // Missing scriptConfig
        }
      ];

      const result = validateWorkflowSteps(steps);

      assert.strictEqual(result.valid, false);
      assert.ok(
        result.errors.some((e) =>
          e.message.includes('Script configuration')
        )
      );
    });

    it('should require valid delaySeconds for delay steps', () => {
      const steps: WorkflowStep[] = [
        {
          id: 'step-1',
          name: 'Step 1',
          type: 'delay',
          order: 1
          // Missing delaySeconds
        }
      ];

      const result = validateWorkflowSteps(steps);

      assert.strictEqual(result.valid, false);
      assert.ok(
        result.errors.some((e) =>
          e.message.includes('Valid delaySeconds is required')
        )
      );
    });

    it('should detect invalid transition targets', () => {
      const steps: WorkflowStep[] = [
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

      const result = validateWorkflowSteps(steps);

      assert.strictEqual(result.valid, false);
      assert.ok(
        result.errors.some((e) =>
          e.message.includes('Invalid transition target')
        )
      );
    });

    it('should validate valid transitions', () => {
      const steps: WorkflowStep[] = [
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

      const result = validateWorkflowSteps(steps);

      assert.strictEqual(result.valid, true);
    });
  });

  describe('validateWorkflowIntegrity', () => {
    it('should validate a workflow with terminate step', () => {
      const workflow: WorkflowDefinition = {
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

      const result = validateWorkflowIntegrity(workflow);

      assert.strictEqual(result.valid, true);
    });

    it('should validate a workflow with implicit end (no transitions on last step)', () => {
      const workflow: WorkflowDefinition = {
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

      const result = validateWorkflowIntegrity(workflow);

      assert.strictEqual(result.valid, true);
    });

    it('should detect duplicate trigger IDs', () => {
      const workflow: WorkflowDefinition = {
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

      const result = validateWorkflowIntegrity(workflow);

      assert.strictEqual(result.valid, false);
      assert.ok(
        result.errors.some((e) => e.message.includes('Duplicate trigger ID'))
      );
    });

    it('should pass step validation errors through', () => {
      const workflow: WorkflowDefinition = {
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

      const result = validateWorkflowIntegrity(workflow);

      assert.strictEqual(result.valid, false);
      assert.ok(
        result.errors.some((e) =>
          e.message.includes('Action configuration is required')
        )
      );
    });

    it('should handle empty steps array', () => {
      const workflow: WorkflowDefinition = {
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

      const result = validateWorkflowIntegrity(workflow);

      assert.strictEqual(result.valid, true);
    });
  });
});

