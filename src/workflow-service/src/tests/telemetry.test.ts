import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  TelemetryClient,
  initializeTelemetry,
  getTelemetryClient,
  trackWorkflowStarted,
  trackWorkflowCompleted,
  trackWorkflowFailed,
  trackStepExecution
} from '../lib/telemetry';
import {
  WorkflowInstance,
  StepExecution
} from '../models/workflowTypes';

describe('Telemetry', () => {
  let capturedEvents: Array<{ type: string; name: string; data: unknown }> = [];

  const mockTelemetryClient: TelemetryClient = {
    trackEvent(name: string, properties?: Record<string, string>): void {
      capturedEvents.push({ type: 'event', name, data: properties });
    },
    trackMetric(
      name: string,
      value: number,
      properties?: Record<string, string>
    ): void {
      capturedEvents.push({ type: 'metric', name, data: { value, properties } });
    },
    trackException(error: Error, properties?: Record<string, string>): void {
      capturedEvents.push({
        type: 'exception',
        name: error.message,
        data: properties
      });
    },
    trackDependency(
      name: string,
      data: string,
      duration: number,
      success: boolean,
      properties?: Record<string, string>
    ): void {
      capturedEvents.push({
        type: 'dependency',
        name,
        data: { data, duration, success, properties }
      });
    },
    async flush(): Promise<void> {
      // No-op
    }
  };

  beforeEach(() => {
    capturedEvents = [];
    initializeTelemetry(mockTelemetryClient);
  });

  describe('initializeTelemetry', () => {
    it('should set the telemetry client', () => {
      const client = getTelemetryClient();
      assert.strictEqual(client, mockTelemetryClient);
    });
  });

  describe('trackWorkflowStarted', () => {
    it('should track workflow started event', () => {
      const instance: WorkflowInstance = {
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

      trackWorkflowStarted(instance);

      assert.strictEqual(capturedEvents.length, 1);
      assert.strictEqual(capturedEvents[0].type, 'event');
      assert.strictEqual(capturedEvents[0].name, 'WorkflowStarted');
      assert.ok((capturedEvents[0].data as Record<string, string>).instanceId);
    });
  });

  describe('trackWorkflowCompleted', () => {
    it('should track workflow completed event and metrics', () => {
      const instance: WorkflowInstance = {
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

      trackWorkflowCompleted(instance, 5000);

      // Should track event and two metrics
      assert.strictEqual(capturedEvents.length, 3);
      assert.strictEqual(capturedEvents[0].name, 'WorkflowCompleted');
      assert.strictEqual(capturedEvents[1].name, 'workflow.duration');
      assert.strictEqual(capturedEvents[2].name, 'workflow.steps.count');
    });
  });

  describe('trackWorkflowFailed', () => {
    it('should track workflow failed event and exception', () => {
      const instance: WorkflowInstance = {
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
      trackWorkflowFailed(instance, error);

      assert.strictEqual(capturedEvents.length, 2);
      assert.strictEqual(capturedEvents[0].name, 'WorkflowFailed');
      assert.strictEqual(capturedEvents[1].type, 'exception');
    });
  });

  describe('trackStepExecution', () => {
    it('should track step execution event and duration metric', () => {
      const instance: WorkflowInstance = {
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

      const stepExecution: StepExecution = {
        stepId: 'step-1',
        stepName: 'Process Data',
        stepType: 'action',
        status: 'completed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 150
      };

      trackStepExecution(instance, stepExecution);

      assert.strictEqual(capturedEvents.length, 2);
      assert.strictEqual(capturedEvents[0].name, 'StepExecuted');
      assert.strictEqual(capturedEvents[1].name, 'step.duration');
    });

    it('should track exception for failed steps', () => {
      const instance: WorkflowInstance = {
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

      const stepExecution: StepExecution = {
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

      trackStepExecution(instance, stepExecution);

      const exceptions = capturedEvents.filter((e) => e.type === 'exception');
      assert.strictEqual(exceptions.length, 1);
      assert.strictEqual(exceptions[0].name, 'Internal server error');
    });
  });
});

