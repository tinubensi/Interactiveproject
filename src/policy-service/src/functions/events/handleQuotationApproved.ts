/**
 * Handle Quotation Approved Event
 * Auto-creates policy request when quotation is approved
 */

import { app, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { generatePolicyRequestReferenceId, generatePolicyNumber } from '../../utils/referenceGenerator';
import { QuotationApprovedEvent, QuotationPolicyIssuedEvent } from '../../models/events';
import { PolicyRequest, Policy, LineOfBusiness } from '../../models/policy';

/**
 * Handle the legacy quotation.approved event
 * Creates a policy request (for cases where manual policy issuance is needed)
 */
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

/**
 * Handle the quotation.policy_issued event
 * Automatically creates a Policy record when quotation is approved
 */
export async function handlePolicyIssued(
  eventGridEvent: any,
  context: InvocationContext
): Promise<void> {
  try {
    const event = eventGridEvent as QuotationPolicyIssuedEvent;
    const data = event.data;

    context.log(`Received quotation.policy_issued event for quotation ${data.quotationId}`);

    const now = new Date();
    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1); // 1 year policy

    // First, create a policy request
    const policyRequest: PolicyRequest = {
      id: uuidv4(),
      referenceId: generatePolicyRequestReferenceId(),
      quotationId: data.quotationId,
      leadId: data.leadId,
      customerId: data.customerId,
      selectedPlanId: data.selectedPlanId,
      vendorId: data.vendorId,
      vendorName: data.vendorName,
      lineOfBusiness: data.lineOfBusiness,
      businessType: data.businessType,
      customerDocuments: [],
      lobSpecificDocuments: [],
      commonDocuments: [],
      status: 'issued', // Automatically issued
      submittedAt: now,
      approvedAt: now,
      issuedAt: now,
      createdAt: now,
      updatedAt: now
    };

    await cosmosService.createPolicyRequest(policyRequest);
    context.log(`Created policy request ${policyRequest.referenceId}`);

    // Then create the actual policy
    const policyNumber = generatePolicyNumber(data.lineOfBusiness);
    const policy: Policy = {
      id: uuidv4(),
      policyNumber,
      customerId: data.customerId,
      leadId: data.leadId,
      quotationId: data.quotationId,
      policyRequestId: policyRequest.id,
      planId: data.selectedPlanId,
      vendorId: data.vendorId,
      vendorName: data.vendorName,
      vendorCode: data.vendorId, // Using vendorId as vendorCode for now
      lineOfBusiness: data.lineOfBusiness,
      businessType: data.businessType,
      planName: data.selectedPlanName,
      planType: 'standard', // Default plan type
      annualPremium: data.annualPremium,
      monthlyPremium: data.annualPremium / 12,
      currency: data.currency,
      annualLimit: 0, // Would come from plan details
      deductible: 0, // Would come from plan details
      coInsurance: 0, // Would come from plan details
      startDate,
      endDate,
      issueDate: now,
      status: 'active',
      isRenewable: true,
      fullPlanData: {},
      createdAt: now,
      updatedAt: now
    };

    await cosmosService.createPolicy(policy);
    context.log(`Created policy ${policy.policyNumber}`);

    // Update the policy request with the policy ID
    await cosmosService.updatePolicyRequest(policyRequest.id, policyRequest.quotationId, {
      policyId: policy.id,
      policyNumber: policy.policyNumber
    });

    // Publish policy issued event
    await eventGridService.publishPolicyIssued({
      policyId: policy.id,
      policyNumber: policy.policyNumber,
      policyRequestId: policyRequest.id,
      quotationId: data.quotationId,
      leadId: data.leadId,
      customerId: data.customerId,
      vendorName: data.vendorName,
      lineOfBusiness: data.lineOfBusiness,
      startDate,
      endDate,
      annualPremium: data.annualPremium
    });

    context.log(`Policy ${policy.policyNumber} issued successfully`);
  } catch (error: any) {
    context.error('Handle policy issued error:', error);
  }
}

// Register both event handlers
app.eventGrid('handleQuotationApproved', {
  handler: handleQuotationApproved
});

app.eventGrid('handlePolicyIssued', {
  handler: handlePolicyIssued
});
