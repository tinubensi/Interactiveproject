import { app, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { CustomerDocumentUploadedEvent } from '../../types/customer';

export async function handleDocumentUploaded(
  eventGridEvent: any,
  context: InvocationContext
): Promise<void> {
  try {
    const eventData = eventGridEvent.data as CustomerDocumentUploadedEvent;

    if (!eventData.customerId) {
      context.log('Invalid CustomerDocumentUploadedEvent: missing customerId');
      return;
    }

    const customer = await cosmosService.getCustomerById(eventData.customerId);
    if (!customer) {
      context.log(`Customer not found: ${eventData.customerId}`);
      return;
    }

    await cosmosService.updateCustomer(eventData.customerId, {
      documentStatus: 'Complete',
    });

    context.log(`Updated document status to Complete for customer ${eventData.customerId}`);
  } catch (error: any) {
    context.log('Handle CustomerDocumentUploadedEvent error:', error);
    throw error;
  }
}

app.eventGrid('handleDocumentUploaded', {
  handler: handleDocumentUploaded,
});

