import { EventGridPublisherClient, AzureKeyCredential } from '@azure/eventgrid';
import { config } from '../config';
import {
  CustomerDocumentUploadedEvent,
  CustomerDocumentExpiredEvent,
  PipelineDocumentUploadedEvent,
  EventType,
} from '../models/Events';

/**
 * Service for publishing events to Azure Event Grid
 */
export class EventGridService {
  private client: EventGridPublisherClient<any> | null = null;
  private config = config;

  private getClient(): EventGridPublisherClient<any> {
    if (!this.client) {
      this.client = new EventGridPublisherClient(
        this.config.eventGrid.topicEndpoint,
        'EventGrid',
        new AzureKeyCredential(this.config.eventGrid.topicKey)
      );
    }
    return this.client;
  }

  private isLocalMock(): boolean {
    return this.config.eventGrid.topicEndpoint.includes('mock-event-grid.local') ||
           this.config.eventGrid.topicEndpoint.includes('mock-event-grid.production');
  }

  constructor() {
    // Lazy initialization
  }

  /**
   * Publish CustomerDocumentUploaded event
   */
  async publishDocumentUploadedEvent(
    event: CustomerDocumentUploadedEvent
  ): Promise<void> {
    // Skip event publishing in local development with mock endpoint
    if (this.isLocalMock()) {
      console.log('[EventGrid] Skipping event publishing (local development mode)');
      console.log('[EventGrid] Would publish:', EventType.DocumentUploaded, event);
      return;
    }

    const eventGridEvent = {
      id: `${event.documentId}-uploaded-${Date.now()}`,
      subject: `documents/${event.documentId}`,
      dataVersion: '1.0',
      eventType: EventType.DocumentUploaded,
      data: event,
      eventTime: new Date(),
    };

    await this.getClient().send([eventGridEvent]);
  }

  /**
   * Publish CustomerDocumentExpired event
   */
  async publishDocumentExpiredEvent(
    event: CustomerDocumentExpiredEvent
  ): Promise<void> {
    // Skip event publishing in local development with mock endpoint
    if (this.isLocalMock()) {
      console.log('[EventGrid] Skipping event publishing (local development mode)');
      console.log('[EventGrid] Would publish:', EventType.DocumentExpired, event);
      return;
    }

    const eventGridEvent = {
      id: `${event.documentId}-expired-${Date.now()}`,
      subject: `documents/${event.documentId}`,
      dataVersion: '1.0',
      eventType: EventType.DocumentExpired,
      data: event,
      eventTime: new Date(),
    };

    await this.getClient().send([eventGridEvent]);
  }

  /**
   * Publish document.uploaded event for pipeline integration
   * This event is published when a document is uploaded for a lead
   */
  async publishPipelineDocumentUploadedEvent(
    event: PipelineDocumentUploadedEvent
  ): Promise<void> {
    // Skip event publishing in local development with mock endpoint
    if (this.isLocalMock()) {
      console.log('[EventGrid] Skipping event publishing (local development mode)');
      console.log('[EventGrid] Would publish:', EventType.PipelineDocumentUploaded, event);
      return;
    }

    const eventGridEvent = {
      id: `${event.documentId}-pipeline-uploaded-${Date.now()}`,
      subject: `documents/${event.documentId}`,
      dataVersion: '1.0',
      eventType: EventType.PipelineDocumentUploaded,
      data: event,
      eventTime: new Date(),
    };

    await this.getClient().send([eventGridEvent]);
  }
}

