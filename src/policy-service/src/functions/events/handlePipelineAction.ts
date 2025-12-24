/**
 * Pipeline Action Handler for Policy Service
 * Handles pipeline.action.issue_policy events from Pipeline Service
 */

import { app, EventGridEvent, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { policyIssuanceService } from '../../services/policyIssuanceService';
import { publishServiceCompletion } from '../../utils/publishCompletion';

/**
 * Pipeline Action Event Data Interface
 */
interface PipelineActionEventData {
  instanceId: string;
  leadId: string;
  actionData: Record<string, any>;
  metadata: {
    correlationId: string;
    pipelineId: string;
    timestamp: string;
  };
}

/**
 * Handle issue_policy action from pipeline
 * Event: pipeline.action.issue_policy
 * 
 * Expected event data:
 * - instanceId: Pipeline instance ID
 * - leadId: Lead ID
 * - actionData: { quotationId, customerId, selectedPlanId }
 * - metadata: { correlationId, pipelineId, timestamp }
 */
async function handleIssuePolicyAction(
  event: EventGridEvent,
  context: InvocationContext
): Promise<void> {
  // Check if event data exists
  if (!event.data) {
    context.error('[PIPELINE ACTION] Event data is undefined');
    throw new Error('Event data is required but was undefined');
  }

  const eventData = event.data as unknown as PipelineActionEventData;
  const { instanceId, leadId, actionData, metadata } = eventData;

  context.log(`[PIPELINE ACTION] issue_policy for lead ${leadId} (instance: ${instanceId})`);
  context.log(`[PIPELINE ACTION] Correlation ID: ${metadata?.correlationId}`);

  try {
    // Extract action data
    const { quotationId, customerId, selectedPlanId } = actionData || {};

    // Validate required data
    if (!quotationId) {
      throw new Error('Missing required data: quotationId');
    }
    if (!customerId) {
      throw new Error('Missing required data: customerId');
    }
    if (!selectedPlanId) {
      throw new Error('Missing required data: selectedPlanId');
    }
    if (!leadId) {
      throw new Error('Missing required data: leadId');
    }
    if (!instanceId) {
      throw new Error('Missing required data: instanceId');
    }

    context.log(`[PIPELINE ACTION] Quotation ID: ${quotationId}`);
    context.log(`[PIPELINE ACTION] Customer ID: ${customerId}`);
    context.log(`[PIPELINE ACTION] Selected Plan ID: ${selectedPlanId}`);

    // Issue policy
    context.log(`[PIPELINE ACTION] Issuing policy...`);
    const policy = await policyIssuanceService.issuePolicy({
      quotationId,
      leadId,
      customerId,
      selectedPlanId,
    });

    context.log(`[PIPELINE ACTION] Policy issued successfully`);
    context.log(`[PIPELINE ACTION] Policy ID: ${policy.id}`);
    context.log(`[PIPELINE ACTION] Policy Number: ${policy.policyNumber}`);

    // Publish service completion event
    await publishServiceCompletion({
      instanceId,
      leadId,
      actionCompleted: 'issue_policy',
      serviceName: 'policy-service',
      correlationId: metadata?.correlationId || 'unknown',
      status: 'success',
      result: {
        policyId: policy.id,
        policyNumber: policy.policyNumber,
        customerId: policy.customerId,
        quotationId: policy.quotationId,
        issuedAt: new Date().toISOString(),
        effectiveDate: policy.startDate,
        expiryDate: policy.endDate,
      },
    });

    context.log(`[PIPELINE ACTION] ✓ issue_policy completed successfully`);
    context.log(`[PIPELINE ACTION] Published service.issue_policy.completed event`);
  } catch (error: any) {
    context.error(`[PIPELINE ACTION] ✗ issue_policy failed:`, error);
    context.error(`[PIPELINE ACTION] Error message: ${error.message}`);
    context.error(`[PIPELINE ACTION] Error stack:`, error.stack);
    
    // Publish failure completion event
    try {
      await publishServiceCompletion({
        instanceId: instanceId || 'unknown',
        leadId: leadId || 'unknown',
        actionCompleted: 'issue_policy',
        serviceName: 'policy-service',
        correlationId: metadata?.correlationId || 'unknown',
        status: 'failure',
        error: {
          code: 'ISSUE_FAILED',
          message: error.message || 'Unknown error',
          retryable: false, // Policy issuance failures are typically not retryable
        },
      });
      context.log(`[PIPELINE ACTION] Published service.issue_policy.failed event`);
    } catch (publishError: any) {
      context.error(`[PIPELINE ACTION] Failed to publish failure event:`, publishError.message);
    }

    // Don't throw - Event Grid will not retry if we throw
    // Pipeline service will handle timeout
  }
}

// Register Event Grid trigger
app.eventGrid('HandleIssuePolicyAction', {
  handler: handleIssuePolicyAction,
});
