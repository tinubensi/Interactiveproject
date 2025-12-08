/**
 * Event Grid Service for Quotation Generation
 */

import { EventGridPublisherClient, AzureKeyCredential } from '@azure/eventgrid';
import { EventGridEvent } from '../models/events';
import { v4 as uuidv4 } from 'uuid';
import { LineOfBusiness } from '../models/plan';

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

  // ==================== SPECIFIC EVENTS ====================

  async publishPlansFetchStarted(data: {
    leadId: string;
    fetchRequestId: string;
    lineOfBusiness: LineOfBusiness;
    vendorCount: number;
  }): Promise<void> {
    await this.publishEvent('plans.fetch_started', `plans/${data.leadId}`, {
      ...data,
      timestamp: new Date()
    });
  }

  async publishPlansFetchCompleted(data: {
    leadId: string;
    fetchRequestId: string;
    totalPlans: number;
    successfulVendors: string[];
    failedVendors: string[];
    plans: any[]; // Include full plans array for Lead Service to save
  }): Promise<void> {
    await this.publishEvent('plans.fetch_completed', `plans/${data.leadId}`, {
      ...data,
      timestamp: new Date()
    });
  }

  async publishPlansFetchFailed(data: {
    leadId: string;
    fetchRequestId: string;
    error: string;
  }): Promise<void> {
    await this.publishEvent('plans.fetch_failed', `plans/${data.leadId}`, {
      ...data,
      timestamp: new Date()
    });
  }

  async publishPlansFiltered(data: {
    leadId: string;
    filterCriteria: any;
    resultCount: number;
  }): Promise<void> {
    await this.publishEvent('plans.filtered', `plans/${data.leadId}`, {
      ...data,
      timestamp: new Date()
    });
  }

  async publishPlansCompared(data: {
    leadId: string;
    comparisonId: string;
    planIds: string[];
  }): Promise<void> {
    await this.publishEvent('plans.compared', `plans/${data.leadId}`, {
      ...data,
      timestamp: new Date()
    });
  }

  async publishPlansSelected(data: {
    leadId: string;
    planIds: string[];
    selectedBy?: string;
  }): Promise<void> {
    await this.publishEvent('plans.selected', `plans/${data.leadId}`, {
      ...data,
      timestamp: new Date()
    });
  }
}

export const eventGridService = new EventGridService();

