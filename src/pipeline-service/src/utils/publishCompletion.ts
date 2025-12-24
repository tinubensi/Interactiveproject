/**
 * DRY Completion Event Publishing Utility
 * Common utility for all services to publish completion events
 */

import { publishEvent } from '../services/eventGridService';

export interface CompletionEventParams {
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
 * Publish completion event (success or failure)
 */
export async function publishCompletion(params: CompletionEventParams): Promise<void> {
  const { status, serviceName, actionCompleted, leadId, ...data } = params;
  
  const eventType = status === 'success' 
    ? `service.${actionCompleted}.completed` 
    : `service.${actionCompleted}.failed`;

  // Map action names to standard completion event types
  const eventTypeMap: Record<string, string> = {
    'plans_fetched': 'service.plans.fetched',
    'plans_fetch_failed': 'service.plans.fetch_failed',
    'send_quotation': 'service.quotation.sent',
    'send_quotation_failed': 'service.quotation.send_failed',
    'issue_policy': 'service.policy.issued',
    'issue_policy_failed': 'service.policy.issue_failed',
  };

  const mappedEventType = eventTypeMap[actionCompleted] || eventType;

  await publishEvent(
    mappedEventType,
    `/${serviceName}/${leadId}/completion`,
    {
      ...data,
      actionCompleted,
      status,
      result: params.result || {},
      error: params.error,
    },
    '2.0'
  );
}

