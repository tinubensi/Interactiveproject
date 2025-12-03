/**
 * Handle Quotation Approved Event
 * Auto-creates policy request when quotation is approved
 */

import { app, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { generatePolicyRequestReferenceId } from '../../utils/referenceGenerator';
import { QuotationApprovedEvent } from '../../models/events';
import { PolicyRequest } from '../../models/policy';

export async function handleQuotationApproved(
  eventGridEvent: any,
  context: InvocationContext
): Promise<void> {
  try {
    const event = eventGridEvent as QuotationApprovedEvent;
    const data = event.data;

    context.log(`Received quotation.approved event for quotation ${data.quotationId}`);

    // Create policy request
    const policyRequest: PolicyRequest = {
      id: uuidv4(),
      referenceId: generatePolicyRequestReferenceId(),
      quotationId: data.quotationId,
      leadId: data.leadId,
      customerId: data.customerId,
      selectedPlanId: data.selectedPlanId,
      vendorId: 'vendor-1', // TODO: Get from quotation
      vendorName: 'Vendor Name', // TODO: Get from quotation
      lineOfBusiness: 'medical', // TODO: Get from quotation
      businessType: 'individual', // TODO: Get from quotation
      customerDocuments: [],
      lobSpecificDocuments: [],
      commonDocuments: [],
      status: 'pending',
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await cosmosService.createPolicyRequest(policyRequest);

    await eventGridService.publishPolicyRequestCreated({
      policyRequestId: policyRequest.id,
      referenceId: policyRequest.referenceId,
      quotationId: data.quotationId,
      leadId: data.leadId,
      customerId: data.customerId,
      vendorName: policyRequest.vendorName,
      lineOfBusiness: policyRequest.lineOfBusiness
    });

    context.log(`Auto-created policy request ${policyRequest.referenceId}`);
  } catch (error: any) {
    context.error('Handle quotation approved error:', error);
  }
}

app.eventGrid('handleQuotationApproved', {
  handler: handleQuotationApproved
});


