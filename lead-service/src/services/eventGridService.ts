/**
 * Event Grid Service
 * Handles publishing events to Azure Event Grid
 */

import { EventGridPublisherClient, AzureKeyCredential } from '@azure/eventgrid';
import { LeadServicePublishedEvent, EventGridEvent } from '../models/events';
import { v4 as uuidv4 } from 'uuid';

class EventGridService {
  private client: EventGridPublisherClient<"EventGrid"> | null;
  private topicEndpoint: string;
  private enabled: boolean;

  constructor() {
    this.topicEndpoint = process.env.EVENT_GRID_TOPIC_ENDPOINT || '';
    const topicKey = process.env.EVENT_GRID_TOPIC_KEY || '';

    // Only initialize if endpoint is configured
    if (this.topicEndpoint && topicKey && !this.topicEndpoint.includes('localhost')) {
      try {
        this.client = new EventGridPublisherClient(
          this.topicEndpoint,
          'EventGrid',
          new AzureKeyCredential(topicKey)
        );
        this.enabled = true;
        console.log('Event Grid client initialized');
      } catch (error) {
        console.warn('Event Grid initialization failed, running without events:', error);
        this.client = null;
        this.enabled = false;
      }
    } else {
      console.log('Event Grid not configured, running in local mode without events');
      this.client = null;
      this.enabled = false;
    }
  }

  /**
   * Publish a single event
   */
  async publishEvent(
    eventType: string,
    subject: string,
    data: any,
    dataVersion: string = '1.0'
  ): Promise<void> {
    if (!this.enabled || !this.client) {
      console.log(`[LOCAL MODE] Event would be published: ${eventType} for ${subject}`);
      return;
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
      console.log(`Event published: ${eventType} for ${subject}`);
    } catch (error) {
      console.error(`Failed to publish event ${eventType}:`, error);
      // Don't throw in local development
      if (this.topicEndpoint && !this.topicEndpoint.includes('localhost')) {
        throw error;
      }
    }
  }

  /**
   * Publish multiple events in batch
   */
  async publishEvents(events: EventGridEvent[]): Promise<void> {
    if (!this.enabled || !this.client) {
      console.log(`[LOCAL MODE] Batch of ${events.length} events would be published`);
      return;
    }

    try {
      await this.client.send(events as any);
      console.log(`Batch of ${events.length} events published`);
    } catch (error) {
      console.error('Failed to publish batch events:', error);
      // Don't throw in local development
      if (this.topicEndpoint && !this.topicEndpoint.includes('localhost')) {
        throw error;
      }
    }
  }

  // ==================== LEAD SERVICE SPECIFIC EVENTS ====================

  /**
   * Publish lead.created event
   */
  async publishLeadCreated(data: {
    leadId: string;
    referenceId: string;
    customerId: string;
    lineOfBusiness: string;
    businessType: string;
    formId?: string;
    formData?: any;
    lobData: any;
    assignedTo?: string;
    createdAt: Date;
  }): Promise<void> {
    await this.publishEvent(
      'lead.created',
      `leads/${data.leadId}`,
      data,
      '1.0'
    );
  }

  /**
   * Publish lead.updated event
   */
  async publishLeadUpdated(data: {
    leadId: string;
    referenceId: string;
    customerId: string;
    changes: Array<{ field: string; oldValue: any; newValue: any }>;
    updatedBy?: string;
    updatedAt: Date;
  }): Promise<void> {
    await this.publishEvent(
      'lead.updated',
      `leads/${data.leadId}`,
      data,
      '1.0'
    );
  }

  /**
   * Publish lead.stage_changed event
   */
  async publishLeadStageChanged(data: {
    leadId: string;
    referenceId: string;
    customerId: string;
    oldStage: string;
    oldStageId: string;
    newStage: string;
    newStageId: string;
    remark?: string;
    changedBy?: string;
    timestamp: Date;
  }): Promise<void> {
    await this.publishEvent(
      'lead.stage_changed',
      `leads/${data.leadId}`,
      data,
      '1.0'
    );
  }

  /**
   * Publish lead.assigned event
   */
  async publishLeadAssigned(data: {
    leadId: string;
    referenceId: string;
    customerId: string;
    previousAssignee?: string;
    newAssignee: string;
    assignedBy?: string;
    timestamp: Date;
  }): Promise<void> {
    await this.publishEvent(
      'lead.assigned',
      `leads/${data.leadId}`,
      data,
      '1.0'
    );
  }

  /**
   * Publish lead.deleted event
   */
  async publishLeadDeleted(data: {
    leadId: string;
    referenceId: string;
    customerId: string;
    deletedBy?: string;
    deletedAt: Date;
  }): Promise<void> {
    await this.publishEvent(
      'lead.deleted',
      `leads/${data.leadId}`,
      data,
      '1.0'
    );
  }

  /**
   * Publish lead.hot_lead_marked event
   */
  async publishLeadHotLeadMarked(data: {
    leadId: string;
    referenceId: string;
    customerId: string;
    markedBy?: string;
    timestamp: Date;
  }): Promise<void> {
    await this.publishEvent(
      'lead.hot_lead_marked',
      `leads/${data.leadId}`,
      data,
      '1.0'
    );
  }
}

export const eventGridService = new EventGridService();

