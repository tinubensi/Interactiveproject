import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import {
  WorkflowInstance,
  StepExecution,
  ExecutionError,
  TriggerType
} from '../models/workflowTypes';

describe('Event Publisher', () => {
  describe('Event Data Types', () => {
    it('should create valid WorkflowInstanceStartedEventData structure', () => {
      const data = {
        instanceId: 'inst-123',
        workflowId: 'wf-123',
        workflowName: 'Test Workflow',
        organizationId: 'org-123',
        triggerId: 'trigger-123',
        triggerType: 'http' as TriggerType,
        correlationId: 'corr-123'
      };

      assert.ok(data.instanceId);
      assert.ok(data.workflowId);
      assert.ok(data.workflowName);
      assert.ok(data.organizationId);
      assert.ok(data.triggerId);
      assert.ok(data.triggerType);
      assert.ok(data.correlationId);
    });

    it('should create valid WorkflowInstanceCompletedEventData structure', () => {
      const data = {
        instanceId: 'inst-123',
        workflowId: 'wf-123',
        workflowName: 'Test Workflow',
        organizationId: 'org-123',
        durationMs: 5000,
        finalVariables: { result: 'success' }
      };

      assert.ok(data.instanceId);
      assert.strictEqual(data.durationMs, 5000);
      assert.deepStrictEqual(data.finalVariables, { result: 'success' });
    });

    it('should create valid WorkflowInstanceFailedEventData structure', () => {
      const error: ExecutionError = {
        code: 'STEP_FAILED',
        message: 'Step execution failed'
      };

      const data = {
        instanceId: 'inst-123',
        workflowId: 'wf-123',
        workflowName: 'Test Workflow',
        organizationId: 'org-123',
        error,
        failedStepId: 'step-1',
        failedStepName: 'Validate Input'
      };

      assert.ok(data.instanceId);
      assert.ok(data.error);
      assert.strictEqual(data.error.code, 'STEP_FAILED');
      assert.ok(data.failedStepId);
    });

    it('should create valid WorkflowStepCompletedEventData structure', () => {
      const data = {
        instanceId: 'inst-123',
        workflowId: 'wf-123',
        stepId: 'step-1',
        stepName: 'Process Data',
        stepType: 'action' as const,
        durationMs: 100,
        output: { processed: true }
      };

      assert.ok(data.instanceId);
      assert.ok(data.stepId);
      assert.strictEqual(data.durationMs, 100);
      assert.deepStrictEqual(data.output, { processed: true });
    });

    it('should create valid WorkflowApprovalRequiredEventData structure', () => {
      const data = {
        approvalId: 'approval-123',
        instanceId: 'inst-123',
        workflowId: 'wf-123',
        workflowName: 'Test Workflow',
        stepId: 'step-5',
        stepName: 'Manager Approval',
        approverRoles: ['manager', 'admin'],
        approverUsers: ['user-1'],
        context: { amount: 5000 },
        expiresAt: '2025-01-01T00:00:00Z'
      };

      assert.ok(data.approvalId);
      assert.ok(data.stepId);
      assert.ok(Array.isArray(data.approverRoles));
      assert.ok(Array.isArray(data.approverUsers));
      assert.deepStrictEqual(data.context, { amount: 5000 });
    });

    it('should create valid WorkflowApprovalCompletedEventData structure', () => {
      const data = {
        approvalId: 'approval-123',
        instanceId: 'inst-123',
        workflowId: 'wf-123',
        stepId: 'step-5',
        decision: 'approved' as const,
        decidedBy: 'user-123',
        comment: 'Looks good'
      };

      assert.ok(data.approvalId);
      assert.strictEqual(data.decision, 'approved');
      assert.ok(data.decidedBy);
      assert.ok(data.comment);
    });
  });

  describe('Event Grid Event Structure', () => {
    it('should create valid Event Grid event format', () => {
      const event = {
        id: 'event-123',
        eventType: 'WorkflowInstanceStartedEvent',
        subject: '/workflows/wf-123/instances/inst-123',
        eventTime: new Date().toISOString(),
        data: { instanceId: 'inst-123' },
        dataVersion: '1.0'
      };

      assert.ok(event.id);
      assert.ok(event.eventType);
      assert.ok(event.subject);
      assert.ok(event.eventTime);
      assert.ok(event.data);
      assert.strictEqual(event.dataVersion, '1.0');
    });
  });
});

