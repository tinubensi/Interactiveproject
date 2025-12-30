/**
 * RPA Event Grid Service
 * Publishes RPA request events to Event Grid for direct container job triggering
 */

import { EventGridPublisherClient, AzureKeyCredential } from '@azure/eventgrid';

class RPAEventGridService {
  private client: EventGridPublisherClient<any> | null = null;
  private enabled: boolean = false;
  private endpoint: string = '';

  constructor() {
    const endpoint = process.env.RPA_EVENTGRID_ENDPOINT;
    const key = process.env.RPA_EVENTGRID_KEY;

    console.log(`[RPA Event Grid] Initializing... Endpoint: ${endpoint ? 'Set' : 'Missing'}, Key: ${key ? 'Set' : 'Missing'}`);

    if (endpoint && key) {
      try {
        this.client = new EventGridPublisherClient(
          endpoint,
          'EventGrid',
          new AzureKeyCredential(key)
        );
        this.enabled = true;
        this.endpoint = endpoint;
        console.log(`✅ RPA Event Grid client initialized successfully`);
        console.log(`   Endpoint: ${endpoint}`);
      } catch (error) {
        console.error('❌ RPA Event Grid initialization failed:', error);
        this.client = null;
        this.enabled = false;
      }
    } else {
      console.warn('⚠️  RPA_EVENTGRID_ENDPOINT or RPA_EVENTGRID_KEY not configured');
      console.warn('   RPA jobs will not be triggered via Event Grid');
      console.warn('   Falling back to queue-based approach if available');
      this.client = null;
      this.enabled = false;
    }
  }

  /**
   * Publish an RPA request event for a specific vendor
   */
  async publishRPARequest(params: {
    leadId: string;
    vendorId: string;
    leadData: any;
  }): Promise<boolean> {
    if (!this.enabled || !this.client) {
      console.warn(`[RPA Event Grid] Cannot publish event - client not initialized`);
      return false;
    }

    try {
      const eventId = `${params.leadId}-${params.vendorId}-${Date.now()}`;
      
      await this.client.send([{
        id: eventId,
        eventType: 'vendor.rpa.requested',
        subject: `lead/${params.leadId}/vendor/${params.vendorId}`,
        dataVersion: '1.0',
        eventTime: new Date(),
        data: {
          vendorId: params.vendorId,
          leadData: params.leadData,
          timestamp: new Date().toISOString()
        }
      }]);

      console.log(`✅ Published RPA event for vendor ${params.vendorId}, lead ${params.leadId}`);
      console.log(`   Event ID: ${eventId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to publish RPA event for vendor ${params.vendorId}:`, error);
      return false;
    }
  }

  /**
   * Publish RPA request events for multiple vendors
   */
  async publishMultipleRequests(params: {
    leadId: string;
    leadData: any;
    vendorIds: string[];
  }): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    console.log(`[RPA Event Grid] Publishing ${params.vendorIds.length} RPA events for lead ${params.leadId}`);

    for (const vendorId of params.vendorIds) {
      const published = await this.publishRPARequest({
        leadId: params.leadId,
        vendorId,
        leadData: params.leadData
      });

      if (published) {
        success++;
      } else {
        failed++;
      }
    }

    console.log(`[RPA Event Grid] Published ${success}/${params.vendorIds.length} events successfully`);
    
    if (failed > 0) {
      console.warn(`[RPA Event Grid] ${failed} events failed to publish`);
    }

    return { success, failed };
  }

  /**
   * Check if RPA Event Grid is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get endpoint information (for debugging)
   */
  getEndpoint(): string {
    return this.endpoint;
  }
}

export const rpaEventGridService = new RPAEventGridService();




