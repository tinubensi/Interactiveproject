/**
 * Azure Storage Queue Service for EMAF
 * Handles async PDF generation jobs
 */

import { QueueServiceClient, QueueClient } from '@azure/storage-queue';
import { getConfig } from '../config';

export interface PdfGenerationJobData {
  jobId: string;
  submissionId: string;
  leadId: string;
}

class QueueService {
  private queueClient: QueueClient | null = null;

  /**
   * Initialize queue client
   */
  private async initialize(): Promise<void> {
    if (this.queueClient) return;

    const config = getConfig();
    const connectionString = config.blobStorage.connectionString;
    const queueName = config.queue.pdfGenerationQueueName;

    if (!connectionString) {
      throw new Error('BLOB_STORAGE_CONNECTION_STRING is not configured');
    }

    const queueServiceClient = QueueServiceClient.fromConnectionString(connectionString);
    this.queueClient = queueServiceClient.getQueueClient(queueName);

    // Create queue if it doesn't exist
    await this.queueClient.createIfNotExists();
  }

  /**
   * Enqueue PDF generation job
   */
  async enqueuePdfGeneration(jobData: PdfGenerationJobData): Promise<void> {
    await this.initialize();

    const message = JSON.stringify(jobData);
    const encodedMessage = Buffer.from(message).toString('base64');

    await this.queueClient!.sendMessage(encodedMessage);
    console.log(`PDF generation job queued: ${jobData.jobId}`);
  }

  /**
   * Get queue length (for monitoring)
   */
  async getQueueLength(): Promise<number> {
    await this.initialize();

    const properties = await this.queueClient!.getProperties();
    return properties.approximateMessagesCount || 0;
  }

  /**
   * Clear all messages from queue (for testing/maintenance)
   */
  async clearQueue(): Promise<void> {
    await this.initialize();

    await this.queueClient!.clearMessages();
    console.log('Queue cleared');
  }
}

export const queueService = new QueueService();
