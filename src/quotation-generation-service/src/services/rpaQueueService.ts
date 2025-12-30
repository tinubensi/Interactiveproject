/**
 * RPA Queue Service
 * Queues RPA jobs to Azure Storage Queue for container job execution
 */

import { QueueClient } from '@azure/storage-queue';

class RPAQueueService {
  private queueClient: QueueClient | null = null;
  private enabled: boolean = false;

  constructor() {
    const connectionString = process.env.RPA_QUEUE_CONNECTION_STRING;
    const queueName = process.env.RPA_QUEUE_NAME || 'rpa-jobs';

    console.log(`[RPA Queue] Initializing... Connection: ${connectionString ? 'Set' : 'Missing'}, Queue: ${queueName}`);

    if (connectionString) {
      try {
        this.queueClient = new QueueClient(connectionString, queueName);
        this.enabled = true;
        console.log(`✅ RPA Queue client initialized successfully for queue: ${queueName}`);
      } catch (error) {
        console.error('❌ RPA Queue initialization failed:', error);
        this.queueClient = null;
        this.enabled = false;
      }
    } else {
      console.warn('⚠️ RPA_QUEUE_CONNECTION_STRING not configured - RPA jobs will not be queued');
      this.queueClient = null;
      this.enabled = false;
    }
  }

  /**
   * Queue an RPA job for plan fetching
   */
  async queuePlanFetchJob(params: {
    leadId: string;
    lineOfBusiness: string;
    businessType: string;
    leadData: any;
    vendorId?: string;
    fetchRequestId?: string;
  }): Promise<boolean> {
    if (!this.enabled || !this.queueClient) {
      console.warn(`[RPA Queue] Cannot queue job - client not initialized`);
      return false;
    }

    try {
      const message = JSON.stringify({
        leadId: params.leadId,
        lineOfBusiness: params.lineOfBusiness,
        businessType: params.businessType,
        leadData: {
          id: params.leadId, // Add leadId to leadData for executor.py
          leadId: params.leadId, // Also add as leadId for compatibility
          ...params.leadData,
          fetchRequestId: params.fetchRequestId
        },
        vendorId: params.vendorId,
        timestamp: new Date().toISOString()
      });

      await this.queueClient.sendMessage(Buffer.from(message).toString('base64'));
      console.log(`✅ RPA job queued successfully for lead ${params.leadId}, vendor: ${params.vendorId || 'all'}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to queue RPA job for lead ${params.leadId}:`, error);
      return false;
    }
  }

  /**
   * Queue RPA jobs for multiple vendors
   */
  async queueMultipleJobs(params: {
    leadId: string;
    lineOfBusiness: string;
    businessType: string;
    leadData: any;
    vendorIds: string[];
    fetchRequestId?: string;
  }): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const vendorId of params.vendorIds) {
      const queued = await this.queuePlanFetchJob({
        ...params,
        vendorId,
        fetchRequestId: params.fetchRequestId
      });

      if (queued) {
        success++;
      } else {
        failed++;
      }
    }

    console.log(`[RPA Queue] Queued ${success}/${params.vendorIds.length} jobs successfully`);
    return { success, failed };
  }

  /**
   * Check if RPA queue is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

export const rpaQueueService = new RPAQueueService();




