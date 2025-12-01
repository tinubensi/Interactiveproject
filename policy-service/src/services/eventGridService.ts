/**
 * Event Grid Service for Policy Service
 */

import { EventGridPublisherClient, AzureKeyCredential } from '@azure/eventgrid';
import { EventGridEvent } from '../models/events';
import { v4 as uuidv4 } from 'uuid';
import { LineOfBusiness, PolicyStatus } from '../models/policy';

class EventGridService {
  private client: EventGridPublisherClient<"EventGrid">;
  private topicEndpoint: string;

  constructor() {
    this.topicEndpoint = process.env.EVENT_GRID_TOPIC_ENDPOINT!;
    const topicKey = process.env.EVENT_GRID_TOPIC_KEY!;

    this.client = new EventGridPublisherClient(
      this.topicEndpoint,
      'EventGrid',
      new AzureKeyCredential(topicKey)
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

  async publishPolicyRequestCreated(data: {
    policyRequestId: string;
    referenceId: string;
    quotationId: string;
    leadId: string;
    customerId: string;
    vendorName: string;
    lineOfBusiness: LineOfBusiness;
  }): Promise<void> {
    await this.publishEvent('policy.request_created', `policy/${data.policyRequestId}`, {
      ...data,
      createdAt: new Date()
    });
  }

  async publishPolicyRequestApproved(data: {
    policyRequestId: string;
    quotationId: string;
    leadId: string;
    customerId: string;
    approvedBy: string;
  }): Promise<void> {
    await this.publishEvent('policy.request_approved', `policy/${data.policyRequestId}`, {
      ...data,
      approvedAt: new Date()
    });
  }

  async publishPolicyRequestRejected(data: {
    policyRequestId: string;
    quotationId: string;
    leadId: string;
    reason: string;
    rejectedBy: string;
  }): Promise<void> {
    await this.publishEvent('policy.request_rejected', `policy/${data.policyRequestId}`, {
      ...data,
      rejectedAt: new Date()
    });
  }

  async publishPolicyIssued(data: {
    policyId: string;
    policyNumber: string;
    policyRequestId: string;
    quotationId: string;
    leadId: string;
    customerId: string;
    vendorName: string;
    lineOfBusiness: LineOfBusiness;
    startDate: Date;
    endDate: Date;
    annualPremium: number;
  }): Promise<void> {
    await this.publishEvent('policy.issued', `policy/${data.policyId}`, {
      ...data,
      issuedAt: new Date()
    });
  }

  async publishPolicyStatusChanged(data: {
    policyId: string;
    customerId: string;
    previousStatus: PolicyStatus;
    newStatus: PolicyStatus;
  }): Promise<void> {
    await this.publishEvent('policy.status_changed', `policy/${data.policyId}`, {
      ...data,
      timestamp: new Date()
    });
  }
}

export const eventGridService = new EventGridService();

