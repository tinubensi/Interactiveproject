import { app, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { PolicyIssuedEvent } from '../../types/customer';

export async function handlePolicyIssued(
  eventGridEvent: any,
  context: InvocationContext
): Promise<void> {
  try {
    const eventData = eventGridEvent.data as PolicyIssuedEvent;

    if (!eventData.customerId || !eventData.policyId) {
      context.log('Invalid PolicyIssuedEvent: missing customerId or policyId');
      return;
    }

    const customer = await cosmosService.getCustomerById(eventData.customerId);
    if (!customer) {
      context.log(`Customer not found: ${eventData.customerId}`);
      return;
    }

    const policies = customer.policies || [];
    if (!policies.includes(eventData.policyId)) {
      policies.push(eventData.policyId);
      await cosmosService.updateCustomer(eventData.customerId, { policies });
      context.log(`Added policy ${eventData.policyId} to customer ${eventData.customerId}`);
    }
  } catch (error: any) {
    context.log('Handle PolicyIssuedEvent error:', error);
    throw error;
  }
}

app.eventGrid('handlePolicyIssued', {
  handler: handlePolicyIssued,
});

