import { EventGridPublisherClient, AzureKeyCredential } from '@azure/eventgrid';
import { CustomerCreatedEvent, CustomerProfileUpdatedEvent } from '../types/customer';

class EventGridService {
  private client: EventGridPublisherClient<any> | null = null;

  private getClient(): EventGridPublisherClient<any> | null {
    // Read environment variables at runtime
    const endpoint = process.env.EVENT_GRID_ENDPOINT || '';
    const key = process.env.EVENT_GRID_KEY || '';

    // If Event Grid is not configured, return null (skip publishing)
    if (!endpoint || !key || endpoint.trim() === '' || key.trim() === '') {
      return null;
    }

    if (!this.client) {
      this.client = new EventGridPublisherClient(
        endpoint,
        'EventGrid',
        new AzureKeyCredential(key)
      );
    }
    return this.client;
  }

  async publishCustomerCreatedEvent(event: CustomerCreatedEvent): Promise<void> {
    const client = this.getClient();
    if (!client) {
      // Event Grid not configured - skip publishing (local development)
      console.log('Event Grid not configured, skipping CustomerCreatedEvent publication');
      return;
    }
    await client.send([
      {
        eventType: 'CustomerCreatedEvent',
        subject: `customers/${event.id}`,
        dataVersion: '1.0',
        data: event,
        eventTime: new Date(),
      },
    ]);
  }

  async publishCustomerProfileUpdatedEvent(event: CustomerProfileUpdatedEvent): Promise<void> {
    const client = this.getClient();
    if (!client) {
      // Event Grid not configured - skip publishing (local development)
      console.log('Event Grid not configured, skipping CustomerProfileUpdatedEvent publication');
      return;
    }
    await client.send([
      {
        eventType: 'CustomerProfileUpdatedEvent',
        subject: `customers/${event.id}`,
        dataVersion: '1.0',
        data: event,
        eventTime: new Date(),
      },
    ]);
  }

  /**
   * Publish customer.created_from_lead event
   * Notifies Lead Service that a customer was successfully created from lead data
   */
  async publishCustomerCreatedFromLead(data: {
    customerId: string;
    tempCustomerId: string;
    leadId: string;
    referenceId: string;
    email: string;
    createdAt: Date;
  }): Promise<void> {
    const client = this.getClient();
    if (!client) {
      console.log('Event Grid not configured, skipping customer.created_from_lead publication');
      return;
    }

    console.log('[DEBUG] publishCustomerCreatedFromLead called');
    console.log('[DEBUG] Customer ID:', data.customerId);
    console.log('[DEBUG] Temp Customer ID:', data.tempCustomerId);
    console.log('[DEBUG] Lead ID:', data.leadId);

    await client.send([
      {
        eventType: 'customer.created_from_lead',
        subject: `customers/${data.customerId}`,
        dataVersion: '1.0',
        data,
        eventTime: new Date(),
      },
    ]);

    console.log('✅ customer.created_from_lead event published successfully');
  }
}

export const eventGridService = new EventGridService();

