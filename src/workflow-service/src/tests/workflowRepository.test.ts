import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  WorkflowNotFoundError,
  StepNotFoundError,
  WorkflowValidationError
} from '../lib/repositories/workflowRepository';
import {
  WorkflowDefinition,
  WorkflowStep,
  CreateWorkflowRequest
} from '../models/workflowTypes';

// Note: Full repository tests require Cosmos DB integration.
// These tests verify the error classes and type definitions.

describe('WorkflowRepository Error Classes', () => {
  describe('WorkflowNotFoundError', () => {
    it('should create error with workflow ID', () => {
      const error = new WorkflowNotFoundError('wf-123');
      assert.strictEqual(error.name, 'WorkflowNotFoundError');
      assert.ok(error.message.includes('wf-123'));
      assert.ok(error.message.includes('not found'));
    });

    it('should create error with workflow ID and version', () => {
      const error = new WorkflowNotFoundError('wf-123', 2);
      assert.ok(error.message.includes('wf-123'));
      assert.ok(error.message.includes('version 2'));
    });
  });

  describe('StepNotFoundError', () => {
    it('should create error with step ID', () => {
      const error = new StepNotFoundError('step-123');
      assert.strictEqual(error.name, 'StepNotFoundError');
      assert.ok(error.message.includes('step-123'));
      assert.ok(error.message.includes('not found'));
    });
  });

  describe('WorkflowValidationError', () => {
    it('should create error with message', () => {
      const error = new WorkflowValidationError('Invalid workflow');
      assert.strictEqual(error.name, 'WorkflowValidationError');
      assert.strictEqual(error.message, 'Invalid workflow');
    });
  });
});

describe('WorkflowRepository Type Definitions', () => {
  it('should create valid workflow definition structure', () => {
    const workflow: WorkflowDefinition = {
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

    assert.strictEqual(workflow.workflowId, 'wf-123');
    assert.strictEqual(workflow.version, 1);
    assert.strictEqual(workflow.status, 'draft');
  });

  it('should create valid workflow step structure', () => {
    const step: WorkflowStep = {
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

    assert.strictEqual(step.type, 'action');
    assert.strictEqual(step.action?.type, 'http_request');
  });

  it('should create valid decision step with conditions', () => {
    const step: WorkflowStep = {
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

    assert.strictEqual(step.conditions?.length, 2);
    assert.strictEqual(step.conditions?.[0].targetStepId, 'step-3');
  });

  it('should create valid parallel step with branches', () => {
    const step: WorkflowStep = {
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

    assert.strictEqual(step.parallelConfig?.branches.length, 2);
    assert.strictEqual(step.parallelConfig?.joinCondition, 'all');
  });

  it('should create valid wait step for event', () => {
    const step: WorkflowStep = {
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

    assert.strictEqual(step.waitConfig?.type, 'event');
  });

  it('should create valid wait step for approval', () => {
    const step: WorkflowStep = {
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

    assert.strictEqual(step.waitConfig?.type, 'approval');
  });

  it('should create valid loop step', () => {
    const step: WorkflowStep = {
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

    assert.strictEqual(step.loopConfig?.collection, '$.items');
    assert.strictEqual(step.loopConfig?.parallelism, 5);
  });

  it('should create valid transform step', () => {
    const step: WorkflowStep = {
      id: 'step-7',
      name: 'Transform Data',
      type: 'transform',
      order: 7,
      transformConfig: {
        expression: '$.items[status = "active"]',
        outputVariable: 'activeItems'
      }
    };

    assert.strictEqual(step.transformConfig?.outputVariable, 'activeItems');
  });

  it('should create valid script step', () => {
    const step: WorkflowStep = {
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

    assert.strictEqual(step.scriptConfig?.timeout, 5000);
  });

  it('should create valid subworkflow step', () => {
    const step: WorkflowStep = {
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

    assert.strictEqual(step.subworkflowConfig?.workflowId, 'child-workflow-1');
  });

  it('should create valid step with error handling', () => {
    const step: WorkflowStep = {
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

    assert.strictEqual(step.onError?.action, 'retry');
    assert.strictEqual(step.onError?.retryPolicy?.maxAttempts, 3);
  });

  it('should create valid create workflow request', () => {
    const request: CreateWorkflowRequest = {
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

    assert.strictEqual(request.name, 'New Workflow');
    assert.strictEqual(request.triggers?.length, 1);
    assert.strictEqual(request.variables?.orderId.type, 'string');
  });
});

describe('Workflow Complex Structures', () => {
  it('should create workflow with compound conditions', () => {
    const step: WorkflowStep = {
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

    assert.strictEqual(step.conditions?.length, 3);
    const firstCondition = step.conditions?.[0].condition;
    assert.ok(firstCondition && 'operator' in firstCondition);
    if (firstCondition && 'operator' in firstCondition) {
      assert.strictEqual(firstCondition.operator, 'and');
    }
  });

  it('should create workflow with all action types', () => {
    const actionTypes = [
      {
        type: 'http_request' as const,
        config: { url: 'https://api.example.com', method: 'GET' as const }
      },
      {
        type: 'publish_event' as const,
        config: { eventType: 'TestEvent', data: {} }
      },
      {
        type: 'send_command' as const,
        config: { queueName: 'commands', command: {} }
      },
      {
        type: 'cosmos_query' as const,
        config: { container: 'items', query: 'SELECT * FROM c' }
      },
      {
        type: 'cosmos_upsert' as const,
        config: { container: 'items', document: {} }
      },
      {
        type: 'cosmos_delete' as const,
        config: { container: 'items', documentId: 'doc-1', partitionKey: 'pk-1' }
      },
      {
        type: 'send_notification' as const,
        config: { channel: 'email' as const, to: 'user@example.com' }
      },
      {
        type: 'call_function' as const,
        config: { functionName: 'ProcessOrder' }
      }
    ];

    const steps: WorkflowStep[] = actionTypes.map((action, index) => ({
      id: `step-${index}`,
      name: `${action.type} Step`,
      type: 'action' as const,
      order: index + 1,
      action: {
        type: action.type,
        config: action.config
      }
    }));

    assert.strictEqual(steps.length, 8);
    steps.forEach((step, index) => {
      assert.strictEqual(step.action?.type, actionTypes[index].type);
    });
  });
});
