/**
 * Event Grid Service for EMAF
 * Publishes events for system integration
 */

import { EventGridPublisherClient, AzureKeyCredential } from '@azure/eventgrid';
import { getConfig } from '../config';
import {
  EMAF_EVENT_TYPES,
  EmafSubmissionCreatedEventData,
  EmafPdfGeneratedEventData,
  EmafSubmissionSubmittedEventData,
  EmafSubmissionApprovedEventData,
  EmafSubmissionRejectedEventData,
  EmafRevisionRequestedEventData,
} from '../models/events';
import { v4 as uuidv4 } from 'uuid';

class EventGridService {
  private client: EventGridPublisherClient<"EventGrid"> | null = null;
  private topicEndpoint: string = '';

  /**
   * Initialize Event Grid client
   */
  private initialize(): void {
    if (this.client) return;

    const config = getConfig();
    this.topicEndpoint = config.eventGrid.topicEndpoint;
    const topicKey = config.eventGrid.topicKey;

    if (!this.topicEndpoint || !topicKey) {
      throw new Error('EVENT_GRID_TOPIC_ENDPOINT and EVENT_GRID_TOPIC_KEY must be configured');
    }

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
  }

  /**
   * Publish generic event
   */
  private async publishEvent(eventType: string, subject: string, data: any): Promise<void> {
    this.initialize();

    const event = {
      id: uuidv4(),
      eventType,
      subject,
      eventTime: new Date(),
      data,
      dataVersion: '1.0',
    };

    try {
      await this.client!.send([event] as any);
      console.log(`Event published: ${eventType}`);
    } catch (error) {
      console.error(`Failed to publish event ${eventType}:`, error);
      // Don't throw - event publishing failure shouldn't break the main flow
    }
  }

  /**
   * Publish submission created event
   */
  async publishSubmissionCreated(data: EmafSubmissionCreatedEventData): Promise<void> {
    await this.publishEvent(
      EMAF_EVENT_TYPES.SUBMISSION_CREATED,
      `/emaf/submissions/${data.submissionId}`,
      data
    );
  }

  /**
   * Publish PDF generated event
   */
  async publishPdfGenerated(data: EmafPdfGeneratedEventData): Promise<void> {
    await this.publishEvent(
      EMAF_EVENT_TYPES.PDF_GENERATED,
      `/emaf/submissions/${data.submissionId}`,
      data
    );
  }

  /**
   * Publish submission submitted event
   */
  async publishSubmissionSubmitted(data: EmafSubmissionSubmittedEventData): Promise<void> {
    await this.publishEvent(
      EMAF_EVENT_TYPES.SUBMISSION_SUBMITTED,
      `/emaf/submissions/${data.submissionId}`,
      data
    );
  }

  /**
   * Publish submission approved event
   */
  async publishSubmissionApproved(data: EmafSubmissionApprovedEventData): Promise<void> {
    await this.publishEvent(
      EMAF_EVENT_TYPES.SUBMISSION_APPROVED,
      `/emaf/submissions/${data.submissionId}`,
      data
    );
  }

  /**
   * Publish submission rejected event
   */
  async publishSubmissionRejected(data: EmafSubmissionRejectedEventData): Promise<void> {
    await this.publishEvent(
      EMAF_EVENT_TYPES.SUBMISSION_REJECTED,
      `/emaf/submissions/${data.submissionId}`,
      data
    );
  }

  /**
   * Publish revision requested event
   */
  async publishRevisionRequested(data: EmafRevisionRequestedEventData): Promise<void> {
    await this.publishEvent(
      EMAF_EVENT_TYPES.REVISION_REQUESTED,
      `/emaf/submissions/${data.submissionId}`,
      data
    );
  }
}

export const eventGridService = new EventGridService();
