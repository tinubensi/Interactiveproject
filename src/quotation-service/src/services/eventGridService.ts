/**
 * Event Grid Service for Quotation Service
 */

import { EventGridPublisherClient, AzureKeyCredential } from '@azure/eventgrid';
import { v4 as uuidv4 } from 'uuid';
import { LineOfBusiness, QuotationStatus } from '../models/quotation';

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

  // ==================== SPECIFIC EVENTS ====================

  async publishQuotationCreated(data: {
    quotationId: string;
    referenceId: string;
    leadId: string;
    customerId: string;
    lineOfBusiness: LineOfBusiness;
    totalPremium: number;
    planCount: number;
    version: number;
    planIds: string[];
  }): Promise<void> {
    await this.publishEvent('quotation.created', `quotation/${data.quotationId}`, {
      ...data,
      createdAt: new Date()
    });
  }

  async publishQuotationUpdated(data: {
    quotationId: string;
    leadId: string;
    updatedFields: string[];
    updatedBy?: string;
  }): Promise<void> {
    await this.publishEvent('quotation.updated', `quotation/${data.quotationId}`, {
      ...data,
      timestamp: new Date()
    });
  }

  async publishQuotationRevised(data: {
    quotationId: string;
    previousQuotationId: string;
    leadId: string;
    version: number;
    reason: string;
    plansChanged: boolean;
  }): Promise<void> {
    await this.publishEvent('quotation.revised', `quotation/${data.quotationId}`, {
      ...data,
      timestamp: new Date()
    });
  }

  async publishQuotationSent(data: {
    quotationId: string;
    leadId: string;
    recipientEmail: string;
    pdfUrl?: string;
  }): Promise<void> {
    await this.publishEvent('quotation.sent', `quotation/${data.quotationId}`, {
      ...data,
      sentAt: new Date()
    });
  }

  async publishQuotationApproved(data: {
    quotationId: string;
    leadId: string;
    customerId: string;
    selectedPlanId: string;
  }): Promise<void> {
    await this.publishEvent('quotation.approved', `quotation/${data.quotationId}`, {
      ...data,
      approvedAt: new Date()
    });
  }

  async publishQuotationRejected(data: {
    quotationId: string;
    leadId: string;
    reason?: string;
  }): Promise<void> {
    await this.publishEvent('quotation.rejected', `quotation/${data.quotationId}`, {
      ...data,
      rejectedAt: new Date()
    });
  }

  async publishQuotationStatusChanged(data: {
    quotationId: string;
    leadId: string;
    previousStatus: QuotationStatus;
    newStatus: QuotationStatus;
    reason?: string;
  }): Promise<void> {
    await this.publishEvent('quotation.status_changed', `quotation/${data.quotationId}`, {
      ...data,
      timestamp: new Date()
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
    lineOfBusiness: LineOfBusiness;
    businessType: string;
  }): Promise<void> {
    await this.publishEvent('quotation.pending_approval', `quotation/${data.quotationId}`, {
      ...data,
      submittedAt: new Date()
    });
  }

  async publishPolicyIssued(data: {
    quotationId: string;
    referenceId: string;
    leadId: string;
    customerId: string;
    selectedPlanId: string;
    selectedPlanName: string;
    vendorId: string;
    vendorName: string;
    annualPremium: number;
    currency: string;
    lineOfBusiness: LineOfBusiness;
    businessType: string;
    approvedBy?: string;
  }): Promise<void> {
    await this.publishEvent('quotation.policy_issued', `quotation/${data.quotationId}`, {
      ...data,
      issuedAt: new Date()
    });
  }
}

export const eventGridService = new EventGridService();
