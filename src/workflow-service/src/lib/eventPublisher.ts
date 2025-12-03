import { getConfig } from './config';
import {
  WorkflowInstance,
  StepExecution,
  ExecutionError,
  WorkflowInstanceStartedEventData,
  WorkflowInstanceCompletedEventData,
  WorkflowInstanceFailedEventData,
  WorkflowStepCompletedEventData,
  WorkflowApprovalRequiredEventData,
  WorkflowApprovalCompletedEventData
} from '../models/workflowTypes';

interface EventGridEvent<T> {
  id: string;
  eventType: string;
  subject: string;
  eventTime: string;
  data: T;
  dataVersion: string;
}

/**
 * Publish an event to Event Grid
 */
const publishEvent = async <T>(
  eventType: string,
  subject: string,
  data: T
): Promise<void> => {
  const config = getConfig();

  if (!config.eventGrid.topicEndpoint || !config.eventGrid.topicKey) {
    console.warn('Event Grid not configured, skipping event publication');
    return;
  }

  const event: EventGridEvent<T> = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    eventType,
    subject,
    eventTime: new Date().toISOString(),
    data,
    dataVersion: '1.0'
  };

  try {
    await fetch(config.eventGrid.topicEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'aeg-sas-key': config.eventGrid.topicKey
      },
      body: JSON.stringify([event])
    });
  } catch (error) {
    console.error('Failed to publish event:', error);
  }
};

/**
 * Publish WorkflowInstanceStartedEvent
 */
export const publishWorkflowInstanceStartedEvent = async (
  instance: WorkflowInstance
): Promise<void> => {
  const data: WorkflowInstanceStartedEventData = {
    instanceId: instance.instanceId,
    workflowId: instance.workflowId,
    workflowName: instance.workflowName,
    organizationId: instance.organizationId,
    triggerId: instance.triggerId,
    triggerType: instance.triggerType,
    correlationId: instance.correlationId
  };

  await publishEvent(
    'WorkflowInstanceStartedEvent',
    `/workflows/${instance.workflowId}/instances/${instance.instanceId}`,
    data
  );
};

/**
 * Publish WorkflowInstanceCompletedEvent
 */
export const publishWorkflowInstanceCompletedEvent = async (
  instance: WorkflowInstance,
  durationMs: number
): Promise<void> => {
  const data: WorkflowInstanceCompletedEventData = {
    instanceId: instance.instanceId,
    workflowId: instance.workflowId,
    workflowName: instance.workflowName,
    organizationId: instance.organizationId,
    durationMs,
    finalVariables: instance.variables
  };

  await publishEvent(
    'WorkflowInstanceCompletedEvent',
    `/workflows/${instance.workflowId}/instances/${instance.instanceId}`,
    data
  );
};

/**
 * Publish WorkflowInstanceFailedEvent
 */
export const publishWorkflowInstanceFailedEvent = async (
  instance: WorkflowInstance,
  failedStep: StepExecution,
  error: ExecutionError
): Promise<void> => {
  const data: WorkflowInstanceFailedEventData = {
    instanceId: instance.instanceId,
    workflowId: instance.workflowId,
    workflowName: instance.workflowName,
    organizationId: instance.organizationId,
    error,
    failedStepId: failedStep.stepId,
    failedStepName: failedStep.stepName
  };

  await publishEvent(
    'WorkflowInstanceFailedEvent',
    `/workflows/${instance.workflowId}/instances/${instance.instanceId}`,
    data
  );
};

/**
 * Publish WorkflowStepCompletedEvent
 */
export const publishWorkflowStepCompletedEvent = async (
  instance: WorkflowInstance,
  stepExecution: StepExecution
): Promise<void> => {
  const data: WorkflowStepCompletedEventData = {
    instanceId: instance.instanceId,
    workflowId: instance.workflowId,
    stepId: stepExecution.stepId,
    stepName: stepExecution.stepName,
    stepType: stepExecution.stepType,
    durationMs: stepExecution.durationMs || 0,
    output: stepExecution.output
  };

  await publishEvent(
    'WorkflowStepCompletedEvent',
    `/workflows/${instance.workflowId}/instances/${instance.instanceId}/steps/${stepExecution.stepId}`,
    data
  );
};

/**
 * Publish WorkflowApprovalRequiredEvent
 */
export const publishWorkflowApprovalRequiredEvent = async (
  approvalId: string,
  instance: WorkflowInstance,
  stepId: string,
  stepName: string,
  approverRoles?: string[],
  approverUsers?: string[],
  context?: Record<string, unknown>,
  expiresAt?: string
): Promise<void> => {
  const data: WorkflowApprovalRequiredEventData = {
    approvalId,
    instanceId: instance.instanceId,
    workflowId: instance.workflowId,
    workflowName: instance.workflowName,
    stepId,
    stepName,
    approverRoles,
    approverUsers,
    context: context || {},
    expiresAt
  };

  await publishEvent(
    'WorkflowApprovalRequiredEvent',
    `/workflows/${instance.workflowId}/instances/${instance.instanceId}/approvals/${approvalId}`,
    data
  );
};

/**
 * Publish WorkflowApprovalCompletedEvent
 */
export const publishWorkflowApprovalCompletedEvent = async (
  approvalId: string,
  instance: WorkflowInstance,
  stepId: string,
  decision: 'approved' | 'rejected',
  decidedBy: string,
  comment?: string
): Promise<void> => {
  const data: WorkflowApprovalCompletedEventData = {
    approvalId,
    instanceId: instance.instanceId,
    workflowId: instance.workflowId,
    stepId,
    decision,
    decidedBy,
    comment
  };

  await publishEvent(
    'WorkflowApprovalCompletedEvent',
    `/workflows/${instance.workflowId}/instances/${instance.instanceId}/approvals/${approvalId}`,
    data
  );
};

/**
 * Publish a custom workflow event
 */
export const publishCustomWorkflowEvent = async (
  eventType: string,
  instance: WorkflowInstance,
  data: Record<string, unknown>
): Promise<void> => {
  await publishEvent(
    eventType,
    `/workflows/${instance.workflowId}/instances/${instance.instanceId}`,
    {
      instanceId: instance.instanceId,
      workflowId: instance.workflowId,
      organizationId: instance.organizationId,
      ...data
    }
  );
};

