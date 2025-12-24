/**
 * Queue Helper for Delayed Actions
 * Replaces setTimeout with durable Storage Queue-based execution
 */

import { QueueServiceClient, QueueClient } from '@azure/storage-queue';

let queueClient: QueueClient | null = null;

/**
 * Get or create the Queue client
 */
function getQueueClient(): QueueClient {
  if (queueClient) {
    return queueClient;
  }

  const connectionString = process.env.AzureWebJobsStorage;
  if (!connectionString) {
    throw new Error('AzureWebJobsStorage connection string not configured');
  }

  const queueService = QueueServiceClient.fromConnectionString(connectionString);
  queueClient = queueService.getQueueClient('pipeline-retries');
  return queueClient;
}

/**
 * Schedule a delayed action via Storage Queue
 * @param action - Type of action to execute
 * @param data - Action-specific data
 * @param delayMs - Delay in milliseconds
 */
export async function scheduleDelayedAction(
  action: 'sync_retry' | 'async_retry' | 'auto_advance',
  data: {
    instanceId: string;
    stepId: string;
    config?: any;
    nextStepId?: string;
    triggeredBy?: string;
  },
  delayMs: number
): Promise<void> {
  const client = getQueueClient();
  
  // Create queue if it doesn't exist
  await client.createIfNotExists();

  const message = {
    action,
    data,
    scheduledAt: new Date().toISOString(),
  };

  // Convert delay to seconds (Storage Queue uses seconds)
  // Maximum visibility timeout is 7 days (604800 seconds)
  const visibilityTimeoutSeconds = Math.min(
    Math.ceil(delayMs / 1000),
    604800
  );

  // Send message with visibility timeout (makes it invisible until delay passes)
  await client.sendMessage(
    Buffer.from(JSON.stringify(message)).toString('base64'),
    { visibilityTimeout: visibilityTimeoutSeconds }
  );

  console.log(`[QUEUE] Scheduled ${action} for instance ${data.instanceId} with ${delayMs}ms delay (${visibilityTimeoutSeconds}s)`);
}

