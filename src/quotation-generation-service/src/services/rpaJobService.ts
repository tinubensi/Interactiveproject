/**
 * RPA Job Service
 * Handles direct Container App Job triggering via queue + manual start
 * 
 * Strategy:
 * 1. Write message to queue (contains lead data)
 * 2. Manually start Container Job (doesn't rely on KEDA)
 * 3. Job reads message from queue and processes
 * 
 * This combines queue-based data passing (works) with manual triggering (reliable)
 */

import { ContainerAppsAPIClient } from '@azure/arm-appcontainers';
import { DefaultAzureCredential } from '@azure/identity';
import { rpaQueueService } from './rpaQueueService';

class RPAJobService {
  private containerAppsClient: ContainerAppsAPIClient | null = null;
  private subscriptionId: string;
  private resourceGroup: string;
  private jobName: string;

  constructor() {
    this.subscriptionId = process.env.AZURE_SUBSCRIPTION_ID || '74e1210c-0bd1-499b-b1bb-13da8d8747bd';
    this.resourceGroup = process.env.CONTAINER_JOB_RESOURCE_GROUP || 'Interactive-CRM-Dev';
    this.jobName = process.env.CONTAINER_JOB_NAME || 'crm-rpa-job';

    console.log('[RPA Job Service] Initialized');
    console.log(`  Subscription: ${this.subscriptionId}`);
    console.log(`  Resource Group: ${this.resourceGroup}`);
    console.log(`  Job Name: ${this.jobName}`);
  }

  /**
   * Get Container Apps API client
   */
  private getClient(): ContainerAppsAPIClient {
    if (!this.containerAppsClient) {
      const credential = new DefaultAzureCredential();
      this.containerAppsClient = new ContainerAppsAPIClient(credential, this.subscriptionId);
      console.log('[RPA Job Service] Container Apps API client created');
    }
    return this.containerAppsClient;
  }

  /**
   * Trigger Container App Job
   * Simply starts a new job execution (no parameters)
   * The job will read messages from the queue
   */
  async triggerJob(): Promise<{
    success: boolean;
    executionName?: string;
    error?: string;
  }> {
    try {
      console.log(`[RPA Job Service] Starting Container Job execution`);

      const client = this.getClient();

      // Start the job (no parameters - job reads from queue)
      const poller = await client.jobs.beginStart(
        this.resourceGroup,
        this.jobName
      );

      const result = await poller.pollUntilDone();

      console.log(`[RPA Job Service] ✅ Job started successfully`);
      console.log(`  Execution: ${result.name}`);

      return {
        success: true,
        executionName: result.name
      };
    } catch (error: any) {
      console.error(`[RPA Job Service] ❌ Failed to start job:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Trigger RPA jobs for multiple vendors
   * Strategy: Queue messages + manually start job executions
   * 
   * 1. Queue messages for all vendors (contains lead data)
   * 2. Start one Container Job execution per message
   * 3. Each job reads one message from queue and processes
   */
  async triggerMultipleJobs(params: {
    leadId: string;
    leadData: any;
    vendorIds: string[];
    lineOfBusiness: string;
    businessType: string;
    fetchRequestId?: string;
  }): Promise<{
    success: number;
    failed: number;
    executionNames: string[];
  }> {
    console.log(`[RPA Job Service] Triggering ${params.vendorIds.length} RPA jobs for lead ${params.leadId}`);

    // Step 1: Queue messages for all vendors
    const queueResult = await rpaQueueService.queueMultipleJobs({
      leadId: params.leadId,
      lineOfBusiness: params.lineOfBusiness,
      businessType: params.businessType,
      leadData: params.leadData,
      vendorIds: params.vendorIds,
      fetchRequestId: params.fetchRequestId
    });

    console.log(`[RPA Job Service] Queued ${queueResult.success} messages`);

    // Step 2: Start Container Job executions (one per queued message)
    let success = 0;
    let failed = 0;
    const executionNames: string[] = [];

    for (let i = 0; i < queueResult.success; i++) {
      try {
        const result = await this.triggerJob();
        
        if (result.success && result.executionName) {
          success++;
          executionNames.push(result.executionName);
        } else {
          failed++;
        }

        // Small delay to avoid rate limiting
        if (i < queueResult.success - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error: any) {
        failed++;
        console.error(`Error starting job execution:`, error);
      }
    }

    console.log(`[RPA Job Service] Started ${success}/${queueResult.success} job executions successfully`);

    return { success, failed, executionNames };
  }
}

export const rpaJobService = new RPAJobService();

