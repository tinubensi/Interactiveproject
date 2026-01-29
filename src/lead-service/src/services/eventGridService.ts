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

    console.log('========================================');
    console.log('EVENT GRID SERVICE INITIALIZATION');
    console.log('========================================');
    console.log(`Endpoint: ${this.topicEndpoint ? this.topicEndpoint : 'NOT SET'}`);
    console.log(`Key: ${topicKey ? 'SET (length: ' + topicKey.length + ')' : 'NOT SET'}`);
    console.log('Timestamp:', new Date().toISOString());

    // Only initialize if endpoint is configured
    if (this.topicEndpoint && topicKey) {
      try {
        console.log('Attempting to create Event Grid client...');
        
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
        console.log('✅ ✅ ✅ EVENT GRID CLIENT INITIALIZED SUCCESSFULLY ✅ ✅ ✅');
        console.log('Endpoint:', this.topicEndpoint);
        console.log('========================================');
      } catch (error) {
        console.error('❌ ❌ ❌ EVENT GRID INITIALIZATION FAILED ❌ ❌ ❌');
        console.error('Error:', error);
        console.error('========================================');
        this.client = null;
        this.enabled = false;
      }
    } else {
      console.warn('⚠️  ⚠️  ⚠️  EVENT GRID NOT CONFIGURED ⚠️  ⚠️  ⚠️');
      console.warn(`Endpoint: ${this.topicEndpoint || 'MISSING'}`);
      console.warn(`Key: ${topicKey ? 'Set' : 'MISSING'}`);
      console.warn('========================================');
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
    console.log(`[Event Grid] Attempting to publish: ${eventType}`);
    
    if (!this.enabled || !this.client) {
      const errorMsg = `Event Grid not enabled or client not initialized. Cannot publish ${eventType} for ${subject}`;
      console.warn(`[EVENT GRID DISABLED] ${errorMsg}`);
      console.warn(`Enabled: ${this.enabled}, Client: ${!!this.client}`);
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

      console.log(`[Event Grid] Publishing event ID: ${event.id}`);
      await this.client.send([event] as any);
      console.log(`✅ ✅ Event published successfully: ${eventType} for ${subject}`);
    } catch (error) {
      console.error(`❌ ❌ Failed to publish event ${eventType} for ${subject}:`, error);
      // Throw error so callers can implement fallback logic
      throw error;
    }
  }

  /**
   * Publish multiple events in batch
   */
  async publishEvents(events: EventGridEvent[]): Promise<void> {
    if (!this.enabled || !this.client) {
      const errorMsg = `Event Grid not enabled or client not initialized. Cannot publish batch of ${events.length} events`;
      console.warn(`[EVENT GRID DISABLED] ${errorMsg}`);
      // Throw error to trigger HTTP fallback
      throw new Error(errorMsg);
    }

    try {
      await this.client.send(events as any);
      console.log(`✅ Batch of ${events.length} events published successfully`);
    } catch (error) {
      console.error(`❌ Failed to publish batch of ${events.length} events:`, error);
      throw error;
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
    // 🔧 Contact fields for RPA bots
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: any;
    emirate?: string;
  }): Promise<void> {
    console.log('===========================================');
    console.log('[DEBUG] publishLeadCreated called');
    console.log('[DEBUG] Lead ID:', data.leadId);
    console.log('[DEBUG] Event Grid enabled:', this.enabled);
    console.log('[DEBUG] Event Grid client exists:', !!this.client);
    console.log('===========================================');
    
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
