/**
 * Event Grid Service for Quotation Service
 */

import { EventGridPublisherClient, AzureKeyCredential } from '@azure/eventgrid';
import { v4 as uuidv4 } from 'uuid';

class EventGridService {
  private client: EventGridPublisherClient<"EventGrid"> | null;
  private topicEndpoint: string;
  private enabled: boolean;

  constructor() {
    this.topicEndpoint = process.env.EVENT_GRID_TOPIC_ENDPOINT || '';
    const topicKey = process.env.EVENT_GRID_TOPIC_KEY || '';

    console.log(`[Event Grid] Initializing... Endpoint: ${this.topicEndpoint ? 'Set' : 'Missing'}, Key: ${topicKey ? 'Set' : 'Missing'}`);

    // Only initialize if endpoint is configured
    if (this.topicEndpoint && topicKey) {
      try {
        // Allow insecure connection for localhost development
        const clientOptions = this.topicEndpoint.includes('localhost') || this.topicEndpoint.includes('127.0.0.1')
          ? { allowInsecureConnection: true }
          : undefined;
        
        this.client = new EventGridPublisherClient(
          this.topicEndpoint,
          'EventGrid',
          new AzureKeyCredential(topicKey),
          clientOptions
        );
        this.enabled = true;
        console.log(`✅ Event Grid client initialized successfully. Endpoint: ${this.topicEndpoint}`);
      } catch (error) {
        console.error('❌ Event Grid initialization failed:', error);
        this.client = null;
        this.enabled = false;
      }
    } else {
      console.warn(`⚠️  Event Grid not configured - Endpoint: ${this.topicEndpoint || 'MISSING'}, Key: ${topicKey ? 'Set' : 'MISSING'}`);
      this.client = null;
      this.enabled = false;
    }
  }

  async publishEvent(eventType: string, subject: string, data: any, dataVersion: string = '1.0'): Promise<void> {
    if (!this.enabled || !this.client) {
      const errorMsg = `Event Grid not enabled or client not initialized. Cannot publish ${eventType} for ${subject}`;
      console.warn(`[EVENT GRID DISABLED] ${errorMsg}`);
      // Throw error to trigger HTTP fallback
      throw new Error(errorMsg);
    }

    try {
      const event = {
        id: uuidv4(),
        eventType,
        subject,
        eventTime: new Date().toISOString(),
        data,
        dataVersion
      };

      await this.client.send([event] as any);
      console.log(`✅ Event published successfully: ${eventType} for ${subject}`);
    } catch (error) {
      console.error(`❌ Failed to publish event ${eventType} for ${subject}:`, error);
      throw error;
    }
  }

  async publishQuotationSent(data: {
    quotationId: string;
    leadId: string;
    recipientEmail: string;
  }): Promise<void> {
    await this.publishEvent('quotation.sent', `quotation/${data.quotationId}`, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  async publishQuotationPendingApproval(data: {
    quotationId: string;
    referenceId: string;
    leadId: string;
    customerId: string;
    selectedPlanId: string;
    selectedPlanName: string;
    vendorName: string;
    annualPremium: number;
    currency: string;
    lineOfBusiness: string;
    businessType: string;
  }): Promise<void> {
    await this.publishEvent('quotation.pending_approval', `quotation/${data.quotationId}`, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  async publishQuotationRejected(data: {
    quotationId: string;
    leadId: string;
    reason?: string;
  }): Promise<void> {
    await this.publishEvent('quotation.rejected', `quotation/${data.quotationId}`, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }
}

export const eventGridService = new EventGridService();
