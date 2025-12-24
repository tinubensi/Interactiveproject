/**
 * Handle Lead Created Event
 * DISABLED: Pipeline Service now handles plan fetching orchestration
 * This handler is kept for backward compatibility but does nothing
 * Pipeline Service will trigger plan fetching via HTTP call after instance is ready
 */

import { app, EventGridEvent, InvocationContext } from '@azure/functions';

/**
 * Main Event Grid handler for lead.created events
 * DISABLED - Pipeline Service handles plan fetching now
 * This prevents race conditions where plan fetching starts before pipeline instance is ready
 */
async function handleLeadCreatedEvent(
  event: EventGridEvent | EventGridEvent[] | any,
  context: InvocationContext
): Promise<void> {
  // DISABLED: Pipeline Service now handles plan fetching orchestration
  // This prevents race conditions where plan fetching starts before pipeline instance is ready
  context.log('=== Quotation Gen Service: handleLeadCreatedEvent RECEIVED (DISABLED) ===');
  context.log('Pipeline Service now handles plan fetching orchestration - this handler is disabled');
  context.log('Plan fetching will be triggered by Pipeline Service after instance is ready');
  return; // Exit early - do nothing
}

app.eventGrid('handleLeadCreated', {
  handler: handleLeadCreatedEvent
});
