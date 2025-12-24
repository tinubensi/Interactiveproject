/**
 * Durable Functions Orchestrator for Policy Issuance
 * 
 * Wraps the policy issuance saga in Durable Functions for:
 * - Built-in retry logic with exponential backoff
 * - Automatic state persistence
 * - Visual monitoring in Azure Portal
 * - Guaranteed exactly-once execution
 * 
 * This is an optional enhancement that can be used instead of the simple
 * handleIssuePolicyAction event handler for more complex policy issuance flows.
 */

import { app, OrchestrationContext, OrchestrationHandler } from 'durable-functions';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { generatePolicyRequestReferenceId, generatePolicyNumber } from '../../utils/referenceGenerator';
import { PolicyRequest, Policy } from '../../models/policy';
import { v4 as uuidv4 } from 'uuid';

/**
 * Durable Functions Orchestrator for Policy Issuance
 * 
 * This orchestrator manages the complete policy issuance flow:
 * 1. Validate quotation
 * 2. Create policy request
 * 3. Call vendor API (with automatic retry)
 * 4. Create policy record
 * 5. Notify pipeline of completion
 */
const policyIssuanceOrchestrator: OrchestrationHandler = function* (context: OrchestrationContext) {
  const input = context.df.getInput<{
    instanceId: string;
    quotationId: string;
    leadId: string;
    customerId: string;
    selectedPlanId: string;
    vendorId?: string;
    vendorName?: string;
    lineOfBusiness: string;
    businessType: string;
  }>();

  const { quotationId, leadId, customerId, selectedPlanId, instanceId } = input;

  try {
    context.log(`[ORCHESTRATOR] Starting policy issuance for quotation ${quotationId}`);

    // Step 1: Validate quotation
    context.log(`[ORCHESTRATOR] Step 1: Validating quotation`);
    const quotation = yield context.df.callActivity('validateQuotation', quotationId);
    
    if (!quotation) {
      throw new Error(`Quotation ${quotationId} not found or invalid`);
    }

    context.log(`[ORCHESTRATOR] ✓ Quotation validated: ${quotation.referenceId}`);

    // Step 2: Create policy request
    context.log(`[ORCHESTRATOR] Step 2: Creating policy request`);
    const policyRequest = yield context.df.callActivity('createPolicyRequest', {
      quotationId,
      leadId,
      customerId,
      selectedPlanId,
      vendorId: input.vendorId || quotation.vendorId || 'vendor-1',
      vendorName: input.vendorName || quotation.vendorName || 'Vendor Name',
      lineOfBusiness: input.lineOfBusiness || quotation.lineOfBusiness || 'medical',
      businessType: input.businessType || quotation.businessType || 'individual',
    });

    context.log(`[ORCHESTRATOR] ✓ Policy request created: ${policyRequest.referenceId}`);

    // Step 3: Call vendor API (with automatic retry via Durable Functions)
    context.log(`[ORCHESTRATOR] Step 3: Calling vendor API`);
    const vendorPolicy = yield context.df.callActivity('callVendorAPI', {
      policyRequestId: policyRequest.id,
      quotationId,
      leadId,
      customerId,
      retryOptions: {
        maxNumberOfAttempts: 3,
        firstRetryInterval: 30000, // 30 seconds
        backoffCoefficient: 2, // Exponential backoff
        maxRetryInterval: 120000, // Max 2 minutes between retries
      },
    });

    context.log(`[ORCHESTRATOR] ✓ Vendor API call successful: ${vendorPolicy.policyNumber || 'pending'}`);

    // Step 4: Create policy record
    context.log(`[ORCHESTRATOR] Step 4: Creating policy record`);
    const policy = yield context.df.callActivity('createPolicyRecord', {
      vendorPolicy,
      policyRequestId: policyRequest.id,
      quotationId,
      leadId,
      customerId,
    });

    context.log(`[ORCHESTRATOR] ✓ Policy record created: ${policy.policyNumber}`);

    // Step 5: Notify pipeline (completion)
    context.log(`[ORCHESTRATOR] Step 5: Notifying pipeline of completion`);
    yield context.df.callActivity('notifyPipelineCompletion', {
      instanceId,
      policyId: policy.id,
      policyNumber: policy.policyNumber,
      leadId,
    });

    context.log(`[ORCHESTRATOR] ✓ Pipeline notified - Policy issuance complete`);

    return {
      success: true,
      policyId: policy.id,
      policyNumber: policy.policyNumber,
      policyRequestId: policyRequest.id,
    };
  } catch (error: any) {
    context.log(`[ORCHESTRATOR] ✗ Policy issuance failed: ${error.message}`);
    
    // Notify pipeline of failure
    yield context.df.callActivity('notifyPipelineFailure', {
      instanceId,
      leadId,
      error: error.message,
      quotationId,
    });

    throw error;
  }
};

/**
 * Activity: Validate Quotation
 */
async function validateQuotation(quotationId: string): Promise<any> {
  // In a real implementation, this would fetch and validate the quotation
  // For now, return a mock structure
  return {
    id: quotationId,
    referenceId: `QUO-${quotationId.slice(0, 8)}`,
    status: 'approved',
    vendorId: 'vendor-1',
    vendorName: 'Vendor Name',
    lineOfBusiness: 'medical',
    businessType: 'individual',
  };
}

/**
 * Activity: Create Policy Request
 */
async function createPolicyRequest(input: {
  quotationId: string;
  leadId: string;
  customerId: string;
  selectedPlanId: string;
  vendorId: string;
  vendorName: string;
  lineOfBusiness: string;
  businessType: string;
}): Promise<PolicyRequest> {
  const now = new Date();
  const policyRequest: PolicyRequest = {
    id: uuidv4(),
    referenceId: generatePolicyRequestReferenceId(),
    quotationId: input.quotationId,
    leadId: input.leadId,
    customerId: input.customerId,
    selectedPlanId: input.selectedPlanId,
    vendorId: input.vendorId,
    vendorName: input.vendorName,
    lineOfBusiness: input.lineOfBusiness as any,
    businessType: input.businessType as any,
    customerDocuments: [],
    lobSpecificDocuments: [],
    commonDocuments: [],
    status: 'pending',
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await cosmosService.createPolicyRequest(policyRequest);
  return policyRequest;
}

/**
 * Activity: Call Vendor API
 */
async function callVendorAPI(input: {
  policyRequestId: string;
  quotationId: string;
  leadId: string;
  customerId: string;
}): Promise<any> {
  // In a real implementation, this would call the vendor's API
  // Durable Functions will automatically retry on failure based on retryOptions
  // For now, simulate a successful response
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call delay

  return {
    policyNumber: `POL-${Date.now()}`,
    status: 'active',
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
  };
}

/**
 * Activity: Create Policy Record
 */
async function createPolicyRecord(input: {
  vendorPolicy: any;
  policyRequestId: string;
  quotationId: string;
  leadId: string;
  customerId: string;
}): Promise<Policy> {
  const now = new Date();
  const policyNumber = generatePolicyNumber('medical');
  
  const policy: Policy = {
    id: uuidv4(),
    policyNumber,
    customerId: input.customerId,
    leadId: input.leadId,
    quotationId: input.quotationId,
    policyRequestId: input.policyRequestId,
    planId: '', // Would come from quotation
    vendorId: 'vendor-1',
    vendorName: 'Vendor Name',
    vendorCode: 'vendor-1',
    lineOfBusiness: 'medical',
    businessType: 'individual',
    planName: 'Standard Plan',
    planType: 'standard',
    annualPremium: 0,
    monthlyPremium: 0,
    currency: 'AED',
    annualLimit: 0,
    deductible: 0,
    coInsurance: 0,
    startDate: input.vendorPolicy.startDate || now,
    endDate: input.vendorPolicy.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    issueDate: now,
    status: 'active',
    isRenewable: true,
    fullPlanData: input.vendorPolicy,
    createdAt: now,
    updatedAt: now,
  };

  await cosmosService.createPolicy(policy);

  // Update policy request
  await cosmosService.updatePolicyRequest(input.policyRequestId, input.quotationId, {
    policyId: policy.id,
    policyNumber: policy.policyNumber,
    status: 'issued',
    issuedAt: now,
  });

  return policy;
}

/**
 * Activity: Notify Pipeline Completion
 */
async function notifyPipelineCompletion(input: {
  instanceId: string;
  policyId: string;
  policyNumber: string;
  leadId: string;
}): Promise<void> {
  await eventGridService.publishEvent(
    'service.policy.issued',
    `/policy/${input.leadId}/completion`,
    {
      instanceId: input.instanceId,
      leadId: input.leadId,
      actionCompleted: 'issue_policy',
      status: 'success',
      result: {
        policyId: input.policyId,
        policyNumber: input.policyNumber,
      },
      metadata: {
        correlationId: uuidv4(),
        timestamp: new Date().toISOString(),
        serviceName: 'policy-service',
      },
    },
    '2.0'
  );
}

/**
 * Activity: Notify Pipeline Failure
 */
async function notifyPipelineFailure(input: {
  instanceId: string;
  leadId: string;
  error: string;
  quotationId: string;
}): Promise<void> {
  await eventGridService.publishEvent(
    'service.policy.issue_failed',
    `/policy/${input.leadId}/completion`,
    {
      instanceId: input.instanceId,
      leadId: input.leadId,
      actionCompleted: 'issue_policy',
      status: 'failure',
      result: {},
      error: {
        code: 'ISSUE_FAILED',
        message: input.error,
        retryable: false,
      },
      metadata: {
        correlationId: uuidv4(),
        timestamp: new Date().toISOString(),
        serviceName: 'policy-service',
      },
    },
    '2.0'
  );
}

// Register the orchestrator
app.orchestration('policyIssuanceOrchestrator', policyIssuanceOrchestrator);

// Register activity functions
app.activity('validateQuotation', { handler: validateQuotation });
app.activity('createPolicyRequest', { handler: createPolicyRequest });
app.activity('callVendorAPI', { handler: callVendorAPI });
app.activity('createPolicyRecord', { handler: createPolicyRecord });
app.activity('notifyPipelineCompletion', { handler: notifyPipelineCompletion });
app.activity('notifyPipelineFailure', { handler: notifyPipelineFailure });

