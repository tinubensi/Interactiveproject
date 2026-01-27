/**
 * Publish Service Completion Event
 * Used to notify pipeline service when an action is completed
 */

import { eventGridService } from '../services/eventGridService';

interface PublishServiceCompletionParams {
  instanceId: string;
  leadId: string;
  actionCompleted: string;
  serviceName: string;
  correlationId: string;
  status: 'success' | 'failure';
  result?: any;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export async function publishServiceCompletion(params: PublishServiceCompletionParams): Promise<void> {
  const { instanceId, leadId, actionCompleted, serviceName, correlationId, status, result, error } = params;

  const eventType = status === 'success'
    ? `service.${actionCompleted}.completed`
    : `service.${actionCompleted}.failed`;

  const subject = `pipeline/${instanceId}/${leadId}`;

  await eventGridService.publishEvent(eventType, subject, {
    instanceId,
    leadId,
    actionCompleted,
    serviceName,
    correlationId,
    status,
    result,
    error,
    timestamp: new Date().toISOString(),
  });
}
