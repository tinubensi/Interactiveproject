import { app, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { CustomerDocumentExpiredEvent } from '../../types/customer';

export async function handleDocumentExpired(
  eventGridEvent: any,
  context: InvocationContext
): Promise<void> {
  try {
    const eventData = eventGridEvent.data as CustomerDocumentExpiredEvent;

    if (!eventData.customerId) {
      context.log('Invalid CustomerDocumentExpiredEvent: missing customerId');
      return;
    }

    const customer = await cosmosService.getCustomerById(eventData.customerId);
    if (!customer) {
      context.log(`Customer not found: ${eventData.customerId}`);
      return;
    }

    await cosmosService.updateCustomer(eventData.customerId, {
      documentStatus: 'Missing Documents',
    });

    context.log(`Updated document status to Missing Documents for customer ${eventData.customerId}`);
  } catch (error: any) {
    context.log('Handle CustomerDocumentExpiredEvent error:', error);
    throw error;
  }
}

app.eventGrid('handleDocumentExpired', {
  handler: handleDocumentExpired,
});

