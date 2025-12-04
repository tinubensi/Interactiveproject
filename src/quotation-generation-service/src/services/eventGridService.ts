/**
 * Event Grid Service for Quotation Generation
 */

import { EventGridPublisherClient, AzureKeyCredential } from '@azure/eventgrid';
import { EventGridEvent } from '../models/events';
import { v4 as uuidv4 } from 'uuid';
import { LineOfBusiness } from '../models/plan';

class EventGridService {
  private client: EventGridPublisherClient<"EventGrid">;
  private topicEndpoint: string;

  constructor() {
    this.topicEndpoint = process.env.EVENT_GRID_TOPIC_ENDPOINT!;
    const topicKey = process.env.EVENT_GRID_TOPIC_KEY!;

    this.client = new EventGridPublisherClient(
      this.topicEndpoint,
      'EventGrid',
      new AzureKeyCredential(topicKey),
      {
        allowInsecureConnection: true // Allow HTTP connections for local Event Grid mock
      }
    );
  }

  async publishEvent(eventType: string, subject: string, data: any, dataVersion: string = '1.0'): Promise<void> {
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
      console.log(`Event published: ${eventType}`);
    } catch (error) {
      console.error(`Failed to publish event ${eventType}:`, error);
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

