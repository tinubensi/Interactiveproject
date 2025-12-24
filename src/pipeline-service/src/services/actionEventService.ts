/**
 * Action Event Service
 * Publishes action events to services and handles completion events
 */

import { publishEvent } from './eventGridService';
import type { PipelineActionEvent, ServiceCompletionEvent } from '../models/events';

/**
 * Publish an action event to Event Grid
 */
export async function publishActionEvent(
  event: PipelineActionEvent
): Promise<void> {
  await publishEvent(
    event.eventType,
    `/pipeline/${event.data.instanceId}/action`,
    event.data,
    '2.0'
  );
}

/**
 * Publish a service completion event to Event Grid
 */
export async function publishServiceCompletion(
  completion: ServiceCompletionEvent
): Promise<void> {
  await publishEvent(
    completion.eventType,
    `/service/${completion.data.metadata?.serviceName || 'unknown'}/completion`,
    completion.data,
    '2.0'
  );
}

