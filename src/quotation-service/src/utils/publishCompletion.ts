/**
 * Service Completion Event Publisher
 * DRY utility for publishing service completion events to Event Grid
 */

import { eventGridService } from '../services/eventGridService';

export interface CompletionParams {
  instanceId: string;
  leadId: string;
  actionCompleted: string;
  serviceName: string;
  correlationId: string;
  status: 'success' | 'failure';
  result?: Record<string, any>;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

/**
 * Publish service completion event to Event Grid
 * Event format: service.{actionCompleted}.completed or service.{actionCompleted}.failed
 */
export async function publishServiceCompletion(params: CompletionParams): Promise<void> {
  const eventType = params.status === 'success' 
    ? `service.${params.actionCompleted}.completed`
    : `service.${params.actionCompleted}.failed`;

  await eventGridService.publishEvent(
    eventType,
    `/${params.serviceName}/${params.leadId}/completion`,
    {
      instanceId: params.instanceId,
      leadId: params.leadId,
      actionCompleted: params.actionCompleted,
      status: params.status,
      result: params.result || {},
      error: params.error,
      metadata: {
        correlationId: params.correlationId,
        timestamp: new Date().toISOString(),
        serviceName: params.serviceName,
      },
    },
    '2.0'
  );
}

