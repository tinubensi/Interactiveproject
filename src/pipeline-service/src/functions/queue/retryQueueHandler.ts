/**
 * Queue Handler for Delayed Actions
 * Processes delayed retries and auto-advance actions from Storage Queue
 */

import { app, InvocationContext } from '@azure/functions';
import { getInstance } from '../../repositories/instanceRepository';
import { getPipeline } from '../../repositories/pipelineRepository';
import { processEvent } from '../../lib/orchestrator';

/**
 * Queue trigger handler for pipeline retries and delayed actions
 */
async function handler(
  queueItem: unknown,
  context: InvocationContext
): Promise<void> {
  try {
    // Parse the queue message
    const messageText = (queueItem as any).messageText || queueItem;
    const payload = JSON.parse(Buffer.from(messageText, 'base64').toString());

    const { action, data } = payload;
    context.log(`[QUEUE HANDLER] Processing action: ${action} for instance ${data.instanceId}`);
    context.log(`[QUEUE HANDLER] Scheduled at: ${payload.scheduledAt}`);

    // Get and validate the instance
    const instance = await getInstance(data.instanceId);

    if (!instance) {
      context.log(`[QUEUE HANDLER] ⚠ Instance ${data.instanceId} not found - skipping`);
      return;
    }

    // Check if instance is still active
    if (['completed', 'cancelled', 'failed'].includes(instance.status)) {
      context.log(`[QUEUE HANDLER] ⚠ Instance ${data.instanceId} is ${instance.status} - skipping action`);
      return;
    }

    // Get the pipeline definition
    const pipeline = await getPipeline(instance.pipelineId);
    const step = pipeline.steps.find(s => s.id === data.stepId);

    if (!step) {
      context.log(`[QUEUE HANDLER] ⚠ Step ${data.stepId} not found in pipeline - skipping`);
      return;
    }

    context.log(`[QUEUE HANDLER] Instance ${data.instanceId} is active, current step: ${instance.currentStepId}`);

    switch (action) {
      case 'sync_retry':
        context.log(`[QUEUE HANDLER] Executing sync retry for step ${data.stepId}`);
        
        // Validate that this is a stage step (sync/async actions only work with stage steps)
        if (step.type !== 'stage') {
          context.error(`[QUEUE HANDLER] ✗ Step ${data.stepId} is type "${step.type}", not "stage" - cannot execute sync retry`);
          context.error(`[QUEUE HANDLER] Sync/async actions only work with stage steps. This is likely a configuration error.`);
          return;
        }
        
        // Import executeSyncAction dynamically to avoid circular dependencies
        const { executeSyncAction } = await import('../../lib/orchestrator');
        // Safe to cast now - we've verified it's a stage step
        await executeSyncAction(instance, pipeline, step as any, data.config, context.log);
        context.log(`[QUEUE HANDLER] ✓ Sync retry completed`);
        break;

      case 'async_retry':
        context.log(`[QUEUE HANDLER] Executing async retry for step ${data.stepId}`);
        
        // Validate that this is a stage step (sync/async actions only work with stage steps)
        if (step.type !== 'stage') {
          context.error(`[QUEUE HANDLER] ✗ Step ${data.stepId} is type "${step.type}", not "stage" - cannot execute async retry`);
          context.error(`[QUEUE HANDLER] Sync/async actions only work with stage steps. This is likely a configuration error.`);
          return;
        }
        
        // Import executeAsyncAction dynamically to avoid circular dependencies
        const { executeAsyncAction } = await import('../../lib/orchestrator');
        // Safe to cast now - we've verified it's a stage step
        await executeAsyncAction(instance, step as any, data.config, context.log);
        context.log(`[QUEUE HANDLER] ✓ Async retry completed`);
        break;

      case 'auto_advance':
        context.log(`[QUEUE HANDLER] Executing auto-advance for step ${data.stepId}`);

        // Critical validation: Check if instance is still on the same step
        if (instance.currentStepId !== data.stepId) {
          context.log(`[QUEUE HANDLER] ⚠ Instance has moved to step ${instance.currentStepId}, expected ${data.stepId} - skipping auto-advance`);
          return;
        }

        // Check if instance is waiting for other events/actions
        if (instance.waitingForEvent) {
          context.log(`[QUEUE HANDLER] ⚠ Instance is waiting for event: ${instance.waitingForEvent} - skipping auto-advance`);
          return;
        }

        if (instance.waitingForAction) {
          context.log(`[QUEUE HANDLER] ⚠ Instance is waiting for action: ${instance.waitingForAction} - skipping auto-advance`);
          return;
        }

        const nextStep = pipeline.steps.find(s => s.id === data.nextStepId);
        if (!nextStep) {
          context.log(`[QUEUE HANDLER] ⚠ Next step ${data.nextStepId} not found - skipping auto-advance`);
          return;
        }

        // Import advanceToStep dynamically to avoid circular dependencies
        const { advanceToStep } = await import('../../lib/orchestrator');
        await advanceToStep(
          instance,
          pipeline,
          step,
          nextStep,
          data.triggeredBy || 'auto_advance',
          'completed',
          context.log
        );
        context.log(`[QUEUE HANDLER] ✓ Auto-advance completed to step ${nextStep.id}`);
        break;

      default:
        context.error(`[QUEUE HANDLER] ✗ Unknown action: ${action}`);
    }
  } catch (error) {
    context.error(`[QUEUE HANDLER] ✗ Error processing queue message:`, error);
    // Rethrow the error to let Azure Functions retry mechanism handle it
    // After max retries, the message will go to the poison queue
    throw error;
  }
}

// Register the Storage Queue trigger
app.storageQueue('RetryQueueHandler', {
  queueName: 'pipeline-retries',
  connection: 'AzureWebJobsStorage',
  handler,
});

