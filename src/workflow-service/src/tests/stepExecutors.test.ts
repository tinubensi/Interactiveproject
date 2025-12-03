import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import {
  executeStep,
  determineNextStep
} from '../lib/executors/stepExecutorDispatcher';
import {
  executeTransform,
  transformResultToStepResult
} from '../lib/executors/transformExecutor';
import {
  executeScript,
  scriptResultToStepResult
} from '../lib/executors/scriptExecutor';
import {
  WorkflowStep,
  ExecutionContext
} from '../models/workflowTypes';
import { ExpressionContext } from '../lib/engine/expressionResolver';

describe('Step Executors', () => {
  describe('executeStep', () => {
    it('should skip disabled steps', async () => {
      const step: WorkflowStep = {
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

      const context: ExecutionContext = {
        instanceId: 'inst-1',
        workflowId: 'wf-1',
        workflowVersion: 1,
        organizationId: 'org-1',
        variables: {},
        stepOutputs: {}
      };

      const result = await executeStep(step, context);

      assert.strictEqual(result.success, true);
      assert.ok((result.output as Record<string, unknown>).skipped);
    });

    it('should execute decision step correctly', async () => {
      const step: WorkflowStep = {
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

      const context: ExecutionContext = {
        instanceId: 'inst-1',
        workflowId: 'wf-1',
        workflowVersion: 1,
        organizationId: 'org-1',
        variables: { amount: 1500 },
        stepOutputs: {}
      };

      const result = await executeStep(step, context);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.nextStepId, 'high-value-step');
    });

    it('should execute setVariable step correctly', async () => {
      const step: WorkflowStep = {
        id: 'set-var-1',
        name: 'Set Variables',
        type: 'setVariable',
        order: 1,
        setVariables: {
          greeting: 'Hello, {{$.name}}!',
          count: 42
        }
      };

      const context: ExecutionContext = {
        instanceId: 'inst-1',
        workflowId: 'wf-1',
        workflowVersion: 1,
        organizationId: 'org-1',
        variables: { name: 'World' },
        stepOutputs: {}
      };

      const result = await executeStep(step, context);

      assert.strictEqual(result.success, true);
      assert.ok(result.variableUpdates);
      assert.strictEqual(result.variableUpdates?.greeting, 'Hello, World!');
      assert.strictEqual(result.variableUpdates?.count, 42);
    });

    it('should execute terminate step correctly', async () => {
      const step: WorkflowStep = {
        id: 'end-1',
        name: 'End',
        type: 'terminate',
        order: 100
      };

      const context: ExecutionContext = {
        instanceId: 'inst-1',
        workflowId: 'wf-1',
        workflowVersion: 1,
        organizationId: 'org-1',
        variables: {},
        stepOutputs: {}
      };

      const result = await executeStep(step, context);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.shouldTerminate, true);
    });

    it('should execute delay step correctly', async () => {
      const step: WorkflowStep = {
        id: 'delay-1',
        name: 'Wait 5 seconds',
        type: 'delay',
        order: 1,
        delaySeconds: 5
      };

      const context: ExecutionContext = {
        instanceId: 'inst-1',
        workflowId: 'wf-1',
        workflowVersion: 1,
        organizationId: 'org-1',
        variables: {},
        stepOutputs: {}
      };

      const result = await executeStep(step, context);

      assert.strictEqual(result.success, true);
      assert.ok((result.output as Record<string, unknown>).requiresOrchestration);
      assert.strictEqual(
        (result.output as Record<string, unknown>).delaySeconds,
        5
      );
    });

    it('should handle unknown step type', async () => {
      const step = {
        id: 'unknown-1',
        name: 'Unknown Step',
        type: 'unknownType' as any,
        order: 1
      };

      const context: ExecutionContext = {
        instanceId: 'inst-1',
        workflowId: 'wf-1',
        workflowVersion: 1,
        organizationId: 'org-1',
        variables: {},
        stepOutputs: {}
      };

      const result = await executeStep(step, context);

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.code.includes('UNKNOWN'));
    });
  });

  describe('Transform Executor', () => {
    it('should execute JSONata transformation', async () => {
      const context: ExpressionContext = {
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

      const result = await executeTransform(
        {
          expression: '$sum(items.price)',
          outputVariable: 'totalPrice'
        },
        context
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data, 350);
      assert.strictEqual(result.outputVariable, 'totalPrice');
    });

    it('should filter items with JSONata', async () => {
      const context: ExpressionContext = {
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

      const result = await executeTransform(
        {
          expression: 'items[active = true]',
          outputVariable: 'activeItems'
        },
        context
      );

      assert.strictEqual(result.success, true);
      assert.ok(Array.isArray(result.data));
      assert.strictEqual((result.data as unknown[]).length, 2);
    });

    it('should handle invalid JSONata expression', async () => {
      const context: ExpressionContext = {
        variables: {},
        stepOutputs: {},
        input: {}
      };

      const result = await executeTransform(
        {
          expression: 'invalid[[[expression',
          outputVariable: 'result'
        },
        context
      );

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    it('should convert transform result to step result', () => {
      const transformResult = {
        success: true,
        data: 100,
        outputVariable: 'total'
      };

      const stepResult = transformResultToStepResult(transformResult);

      assert.strictEqual(stepResult.success, true);
      assert.strictEqual(stepResult.output, 100);
      assert.ok(stepResult.variableUpdates);
      assert.strictEqual(stepResult.variableUpdates?.total, 100);
    });
  });

  describe('Script Executor', () => {
    it('should execute simple script', async () => {
      const context: ExpressionContext = {
        variables: { a: 5, b: 10 },
        stepOutputs: {},
        input: {}
      };

      const result = await executeScript(
        {
          code: 'return $.a + $.b;',
          timeout: 5000
        },
        context
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data, 15);
    });

    it('should access allowed globals', async () => {
      const context: ExpressionContext = {
        variables: { value: 4.7 },
        stepOutputs: {},
        input: {}
      };

      const result = await executeScript(
        {
          code: 'return Math.round($.value);',
          timeout: 5000,
          allowedGlobals: ['Math']
        },
        context
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data, 5);
    });

    it('should handle script errors', async () => {
      const context: ExpressionContext = {
        variables: {},
        stepOutputs: {},
        input: {}
      };

      const result = await executeScript(
        {
          code: 'throw new Error("Test error");',
          timeout: 5000
        },
        context
      );

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      assert.ok(result.error?.message.includes('Test error'));
    });

    it('should convert script result to step result with output variable', () => {
      const scriptResult = {
        success: true,
        data: 'result value'
      };

      const stepResult = scriptResultToStepResult(scriptResult, 'myVar');

      assert.strictEqual(stepResult.success, true);
      assert.strictEqual(stepResult.output, 'result value');
      assert.ok(stepResult.variableUpdates);
      assert.strictEqual(stepResult.variableUpdates?.myVar, 'result value');
    });
  });

  describe('determineNextStep', () => {
    const steps: WorkflowStep[] = [
      { id: 'step-1', name: 'Step 1', type: 'action', order: 1, action: { type: 'http_request', config: { url: '', method: 'GET' } } },
      { id: 'step-2', name: 'Step 2', type: 'action', order: 2, action: { type: 'http_request', config: { url: '', method: 'GET' } } },
      { id: 'step-3', name: 'Step 3', type: 'terminate', order: 3 }
    ];

    it('should use nextStepId from result if present', () => {
      const context: ExpressionContext = {
        variables: {},
        stepOutputs: {},
        input: {}
      };

      const result = determineNextStep(
        steps[0],
        steps,
        context,
        { success: true, nextStepId: 'step-3', shouldTerminate: false }
      );

      assert.strictEqual(result, 'step-3');
    });

    it('should evaluate transitions if present', () => {
      const stepWithTransitions: WorkflowStep = {
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

      const context: ExpressionContext = {
        variables: { skip: true },
        stepOutputs: {},
        input: {}
      };

      const result = determineNextStep(
        stepWithTransitions,
        steps,
        context,
        { success: true, shouldTerminate: false }
      );

      assert.strictEqual(result, 'step-3');
    });

    it('should return next step by order if no transitions', () => {
      const context: ExpressionContext = {
        variables: {},
        stepOutputs: {},
        input: {}
      };

      const result = determineNextStep(
        steps[0],
        steps,
        context,
        { success: true, shouldTerminate: false }
      );

      assert.strictEqual(result, 'step-2');
    });

    it('should return null for last step', () => {
      const context: ExpressionContext = {
        variables: {},
        stepOutputs: {},
        input: {}
      };

      const result = determineNextStep(
        steps[2],
        steps,
        context,
        { success: true, shouldTerminate: false }
      );

      assert.strictEqual(result, null);
    });
  });
});

