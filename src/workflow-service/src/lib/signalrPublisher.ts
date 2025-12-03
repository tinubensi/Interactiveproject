import { ServiceBusClient, ServiceBusSender } from '@azure/service-bus';
import { getConfig } from './config';

// ----------------------------------------------------------------------------
// SignalR Message Types
// ----------------------------------------------------------------------------

export type SignalRMessageType =
  | 'step.started'
  | 'step.completed'
  | 'step.failed'
  | 'instance.started'
  | 'instance.completed'
  | 'instance.failed'
  | 'instance.paused'
  | 'variable.updated'
  | 'approval.required';

export interface SignalRMessage {
  type: SignalRMessageType;
  instanceId: string;
  workflowId: string;
  organizationId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// SignalR Publisher
// ----------------------------------------------------------------------------

let serviceBusSender: ServiceBusSender | null = null;

async function getServiceBusSender(): Promise<ServiceBusSender | null> {
  if (serviceBusSender) {
    return serviceBusSender;
  }

  const config = getConfig();
  const connectionString = config.signalr?.serviceBusConnectionString;
  
  if (!connectionString) {
    console.warn('SignalR Service Bus connection string not configured');
    return null;
  }

  try {
    const client = new ServiceBusClient(connectionString);
    serviceBusSender = client.createSender('workflow-events');
    return serviceBusSender;
  } catch (error) {
    console.error('Failed to create Service Bus sender:', error);
    return null;
  }
}

/**
 * Publish a message to SignalR via Service Bus
 */
export async function publishToSignalR(message: SignalRMessage): Promise<void> {
  const sender = await getServiceBusSender();
  
  if (!sender) {
    // Silently skip if SignalR is not configured
    return;
  }

  try {
    await sender.sendMessages({
      body: message,
      contentType: 'application/json',
      sessionId: message.instanceId, // Group messages by instance
    });
  } catch (error) {
    console.error('Failed to publish SignalR message:', error);
    // Don't throw - SignalR failures shouldn't break workflow execution
  }
}

/**
 * Publish step started event
 */
export async function publishStepStarted(
  instanceId: string,
  workflowId: string,
  organizationId: string,
  stepId: string,
  stepName: string,
  stepType: string
): Promise<void> {
  await publishToSignalR({
    type: 'step.started',
    instanceId,
    workflowId,
    organizationId,
    timestamp: new Date().toISOString(),
    data: {
      stepId,
      stepName,
      stepType,
    },
  });
}

/**
 * Publish step completed event
 */
export async function publishStepCompleted(
  instanceId: string,
  workflowId: string,
  organizationId: string,
  stepId: string,
  stepName: string,
  durationMs: number,
  output?: unknown
): Promise<void> {
  await publishToSignalR({
    type: 'step.completed',
    instanceId,
    workflowId,
    organizationId,
    timestamp: new Date().toISOString(),
    data: {
      stepId,
      stepName,
      durationMs,
      output,
    },
  });
}

/**
 * Publish step failed event
 */
export async function publishStepFailed(
  instanceId: string,
  workflowId: string,
  organizationId: string,
  stepId: string,
  stepName: string,
  error: string,
  errorCode?: string
): Promise<void> {
  await publishToSignalR({
    type: 'step.failed',
    instanceId,
    workflowId,
    organizationId,
    timestamp: new Date().toISOString(),
    data: {
      stepId,
      stepName,
      error,
      errorCode,
    },
  });
}

/**
 * Publish instance started event
 */
export async function publishInstanceStarted(
  instanceId: string,
  workflowId: string,
  organizationId: string,
  workflowName: string,
  triggerType: string
): Promise<void> {
  await publishToSignalR({
    type: 'instance.started',
    instanceId,
    workflowId,
    organizationId,
    timestamp: new Date().toISOString(),
    data: {
      workflowName,
      triggerType,
    },
  });
}

/**
 * Publish instance completed event
 */
export async function publishInstanceCompleted(
  instanceId: string,
  workflowId: string,
  organizationId: string,
  durationMs: number,
  finalVariables?: Record<string, unknown>
): Promise<void> {
  await publishToSignalR({
    type: 'instance.completed',
    instanceId,
    workflowId,
    organizationId,
    timestamp: new Date().toISOString(),
    data: {
      durationMs,
      finalVariables,
    },
  });
}

/**
 * Publish instance failed event
 */
export async function publishInstanceFailed(
  instanceId: string,
  workflowId: string,
  organizationId: string,
  error: string,
  failedStepId?: string
): Promise<void> {
  await publishToSignalR({
    type: 'instance.failed',
    instanceId,
    workflowId,
    organizationId,
    timestamp: new Date().toISOString(),
    data: {
      error,
      failedStepId,
    },
  });
}

/**
 * Publish variable updated event
 */
export async function publishVariableUpdated(
  instanceId: string,
  workflowId: string,
  organizationId: string,
  variableName: string,
  newValue: unknown
): Promise<void> {
  await publishToSignalR({
    type: 'variable.updated',
    instanceId,
    workflowId,
    organizationId,
    timestamp: new Date().toISOString(),
    data: {
      variableName,
      newValue,
    },
  });
}

/**
 * Publish approval required event
 */
export async function publishApprovalRequired(
  instanceId: string,
  workflowId: string,
  organizationId: string,
  approvalId: string,
  stepId: string,
  stepName: string
): Promise<void> {
  await publishToSignalR({
    type: 'approval.required',
    instanceId,
    workflowId,
    organizationId,
    timestamp: new Date().toISOString(),
    data: {
      approvalId,
      stepId,
      stepName,
    },
  });
}

