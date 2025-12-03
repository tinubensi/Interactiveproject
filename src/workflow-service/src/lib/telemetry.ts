import {
  WorkflowInstance,
  StepExecution,
  WorkflowDefinition
} from '../models/workflowTypes';

/**
 * Telemetry interface for Application Insights integration
 * This provides a abstraction layer that can be implemented with
 * applicationinsights package or other telemetry providers
 */
export interface TelemetryClient {
  trackEvent(name: string, properties?: Record<string, string>): void;
  trackMetric(name: string, value: number, properties?: Record<string, string>): void;
  trackException(error: Error, properties?: Record<string, string>): void;
  trackDependency(
    name: string,
    data: string,
    duration: number,
    success: boolean,
    properties?: Record<string, string>
  ): void;
  flush(): Promise<void>;
}

/**
 * Console-based telemetry client for development
 */
class ConsoleTelemetryClient implements TelemetryClient {
  trackEvent(name: string, properties?: Record<string, string>): void {
    console.log(`[TELEMETRY:EVENT] ${name}`, properties);
  }

  trackMetric(name: string, value: number, properties?: Record<string, string>): void {
    console.log(`[TELEMETRY:METRIC] ${name}=${value}`, properties);
  }

  trackException(error: Error, properties?: Record<string, string>): void {
    console.error(`[TELEMETRY:EXCEPTION] ${error.message}`, error, properties);
  }

  trackDependency(
    name: string,
    data: string,
    duration: number,
    success: boolean,
    properties?: Record<string, string>
  ): void {
    console.log(
      `[TELEMETRY:DEPENDENCY] ${name} (${duration}ms, success=${success})`,
      { data, ...properties }
    );
  }

  async flush(): Promise<void> {
    // No-op for console client
  }
}

// Singleton telemetry client
let telemetryClient: TelemetryClient = new ConsoleTelemetryClient();

/**
 * Initialize telemetry with a custom client
 */
export const initializeTelemetry = (client: TelemetryClient): void => {
  telemetryClient = client;
};

/**
 * Get the telemetry client
 */
export const getTelemetryClient = (): TelemetryClient => {
  return telemetryClient;
};

/**
 * Alias for getTelemetryClient for convenience
 */
export const getTelemetry = getTelemetryClient;

/**
 * Track workflow instance started
 */
export const trackWorkflowStarted = (instance: WorkflowInstance): void => {
  telemetryClient.trackEvent('WorkflowStarted', {
    instanceId: instance.instanceId,
    workflowId: instance.workflowId,
    workflowName: instance.workflowName,
    organizationId: instance.organizationId,
    triggerType: instance.triggerType
  });
};

/**
 * Track workflow instance completed
 */
export const trackWorkflowCompleted = (
  instance: WorkflowInstance,
  durationMs: number
): void => {
  telemetryClient.trackEvent('WorkflowCompleted', {
    instanceId: instance.instanceId,
    workflowId: instance.workflowId,
    workflowName: instance.workflowName,
    organizationId: instance.organizationId,
    stepCount: instance.completedStepIds.length.toString()
  });

  telemetryClient.trackMetric('workflow.duration', durationMs, {
    workflowId: instance.workflowId,
    workflowName: instance.workflowName
  });

  telemetryClient.trackMetric('workflow.steps.count', instance.completedStepIds.length, {
    workflowId: instance.workflowId
  });
};

/**
 * Track workflow instance failed
 */
export const trackWorkflowFailed = (
  instance: WorkflowInstance,
  error: Error
): void => {
  telemetryClient.trackEvent('WorkflowFailed', {
    instanceId: instance.instanceId,
    workflowId: instance.workflowId,
    workflowName: instance.workflowName,
    organizationId: instance.organizationId,
    errorMessage: error.message,
    failedStepId: instance.currentStepId || 'unknown'
  });

  telemetryClient.trackException(error, {
    instanceId: instance.instanceId,
    workflowId: instance.workflowId
  });
};

/**
 * Track step execution
 */
export const trackStepExecution = (
  instance: WorkflowInstance,
  stepExecution: StepExecution
): void => {
  const success = stepExecution.status === 'completed';

  telemetryClient.trackEvent('StepExecuted', {
    instanceId: instance.instanceId,
    workflowId: instance.workflowId,
    stepId: stepExecution.stepId,
    stepName: stepExecution.stepName,
    stepType: stepExecution.stepType,
    status: stepExecution.status
  });

  if (stepExecution.durationMs) {
    telemetryClient.trackMetric('step.duration', stepExecution.durationMs, {
      workflowId: instance.workflowId,
      stepId: stepExecution.stepId,
      stepType: stepExecution.stepType
    });
  }

  if (!success && stepExecution.error) {
    telemetryClient.trackException(
      new Error(stepExecution.error.message),
      {
        instanceId: instance.instanceId,
        stepId: stepExecution.stepId,
        errorCode: stepExecution.error.code
      }
    );
  }
};

/**
 * Track HTTP action execution
 */
export const trackHttpAction = (
  instance: WorkflowInstance,
  stepId: string,
  url: string,
  method: string,
  durationMs: number,
  statusCode: number,
  success: boolean
): void => {
  telemetryClient.trackDependency(
    'HTTP',
    `${method} ${url}`,
    durationMs,
    success,
    {
      instanceId: instance.instanceId,
      stepId,
      statusCode: statusCode.toString()
    }
  );
};

/**
 * Track Cosmos DB operation
 */
export const trackCosmosOperation = (
  operation: 'query' | 'upsert' | 'delete',
  container: string,
  durationMs: number,
  success: boolean,
  properties?: Record<string, string>
): void => {
  telemetryClient.trackDependency(
    'CosmosDB',
    `${operation} ${container}`,
    durationMs,
    success,
    properties
  );
};

/**
 * Track Event Grid publish
 */
export const trackEventPublish = (
  eventType: string,
  durationMs: number,
  success: boolean,
  properties?: Record<string, string>
): void => {
  telemetryClient.trackDependency(
    'EventGrid',
    `publish ${eventType}`,
    durationMs,
    success,
    properties
  );
};

/**
 * Track approval request
 */
export const trackApprovalRequested = (
  instance: WorkflowInstance,
  stepId: string,
  approvalId: string
): void => {
  telemetryClient.trackEvent('ApprovalRequested', {
    instanceId: instance.instanceId,
    workflowId: instance.workflowId,
    stepId,
    approvalId
  });
};

/**
 * Track approval decision
 */
export const trackApprovalDecision = (
  instance: WorkflowInstance,
  approvalId: string,
  decision: 'approved' | 'rejected',
  durationMs: number
): void => {
  telemetryClient.trackEvent('ApprovalDecision', {
    instanceId: instance.instanceId,
    workflowId: instance.workflowId,
    approvalId,
    decision
  });

  telemetryClient.trackMetric('approval.duration', durationMs, {
    workflowId: instance.workflowId,
    decision
  });
};

/**
 * Track workflow definition activation
 */
export const trackWorkflowActivated = (workflow: WorkflowDefinition): void => {
  telemetryClient.trackEvent('WorkflowActivated', {
    workflowId: workflow.workflowId,
    workflowName: workflow.name,
    version: workflow.version.toString(),
    organizationId: workflow.organizationId,
    stepCount: workflow.steps.length.toString(),
    triggerCount: workflow.triggers.length.toString()
  });
};

/**
 * Custom metrics for dashboards
 */
export const trackCustomMetric = (
  name: string,
  value: number,
  properties?: Record<string, string>
): void => {
  telemetryClient.trackMetric(name, value, properties);
};

