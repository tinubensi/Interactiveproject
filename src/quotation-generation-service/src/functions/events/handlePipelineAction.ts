/**
 * Pipeline Action Handler for Quotation Generation Service
 * Handles pipeline.action.fetch_plans events from Pipeline Service
 */

import { app, EventGridEvent, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { planFetchingService } from '../../services/planFetchingService';
import { cosmosService } from '../../services/cosmosService';
import { publishServiceCompletion } from '../../utils/publishCompletion';
import { eventGridService } from '../../services/eventGridService';
import { LineOfBusiness } from '../../models/plan';

/**
 * Pipeline Action Event Data Interface
 */
interface PipelineActionEventData {
  instanceId: string;
  leadId: string;
  lineOfBusiness?: string;
  businessType?: string;
  actionData: Record<string, any>;
  metadata: {
    correlationId: string;
    pipelineId: string;
    timestamp: string;
  };
}

/**
 * Handle fetch_plans action from pipeline
 * Event: pipeline.action.fetch_plans
 * 
 * Expected event data:
 * - instanceId: Pipeline instance ID
 * - leadId: Lead ID
 * - lineOfBusiness: LOB (medical, motor, etc.)
 * - businessType: Business type (individual, group)
 * - actionData: { lobData: { ... lead specific data ... } }
 * - metadata: { correlationId, pipelineId, timestamp }
 */
async function handleFetchPlansAction(
  event: EventGridEvent,
  context: InvocationContext
): Promise<void> {
  // Check if event data exists
  if (!event.data) {
    context.error('[PIPELINE ACTION] Event data is undefined');
    throw new Error('Event data is required but was undefined');
  }

  const eventData = event.data as unknown as PipelineActionEventData;
  const { instanceId, leadId, lineOfBusiness, businessType, actionData, metadata } = eventData;

  context.log(`[PIPELINE ACTION] fetch_plans for lead ${leadId} (instance: ${instanceId})`);
  context.log(`[PIPELINE ACTION] Line of Business: ${lineOfBusiness}, Business Type: ${businessType}`);
  context.log(`[PIPELINE ACTION] Correlation ID: ${metadata?.correlationId}`);

  try {
    // Validate required data
    if (!leadId) {
      throw new Error('Missing required data: leadId');
    }
    if (!lineOfBusiness) {
      throw new Error('Missing required data: lineOfBusiness');
    }
    if (!actionData?.lobData) {
      throw new Error('Missing required data: actionData.lobData');
    }
    if (!instanceId) {
      throw new Error('Missing required data: instanceId');
    }

    // Cast lineOfBusiness to proper type
    const lob = lineOfBusiness as LineOfBusiness;

    context.log(`[PIPELINE ACTION] Creating fetch request...`);

    // Create fetch request in database
    const fetchRequest = await cosmosService.createFetchRequest({
      id: uuidv4(),
      leadId,
      lineOfBusiness: lob,
      businessType: businessType || 'individual',
      leadData: actionData.lobData,
      status: 'fetching',
      totalVendors: 0,
      successfulVendors: [],
      failedVendors: [],
      unavailableVendors: [],
      totalPlansFound: 0,
      createdAt: new Date(),
    });

    context.log(`[PIPELINE ACTION] Fetch request created: ${fetchRequest.id}`);
    context.log(`[PIPELINE ACTION] Fetching plans...`);

    // Publish plans.fetch_started event for Lead Service
    await eventGridService.publishPlansFetchStarted({
      leadId,
      fetchRequestId: fetchRequest.id,
      lineOfBusiness: lob,
      vendorCount: 3, // TODO: Get actual vendor count
    });

    // Fetch plans from vendors
    const result = await planFetchingService.fetchPlansForLead({
      leadId,
      lineOfBusiness: lob,
      businessType: businessType || 'individual',
      leadData: actionData.lobData,
      fetchRequestId: fetchRequest.id,
    });

    context.log(`[PIPELINE ACTION] Plans fetched: ${result.plans.length} plans from ${result.successfulVendors.length} vendors`);

    // Save plans to database
    let savedCount = 0;
    for (const plan of result.plans) {
      try {
        await cosmosService.createPlan(plan);
        savedCount++;
      } catch (planError: any) {
        context.warn(`[PIPELINE ACTION] Failed to save plan ${plan.id}:`, planError.message);
      }
    }

    context.log(`[PIPELINE ACTION] Saved ${savedCount}/${result.plans.length} plans to database`);

    // Update fetch request status
    await cosmosService.updateFetchRequest(fetchRequest.id, leadId, {
      status: 'completed',
      totalVendors: result.successfulVendors.length + result.failedVendors.length,
      successfulVendors: result.successfulVendors,
      failedVendors: result.failedVendors,
      totalPlansFound: result.plans.length,
      completedAt: new Date(),
    });

    context.log(`[PIPELINE ACTION] Fetch request updated to completed`);

    // Publish plans.fetch_completed event for Lead Service
    await eventGridService.publishPlansFetchCompleted({
      leadId,
      fetchRequestId: fetchRequest.id,
      totalPlans: result.plans.length,
      successfulVendors: result.successfulVendors,
      failedVendors: result.failedVendors,
      plans: result.plans,
    });

    // Publish service completion event for Pipeline Service
    await publishServiceCompletion({
      instanceId,
      leadId,
      actionCompleted: 'fetch_plans',
      serviceName: 'quotation-generation-service',
      correlationId: metadata?.correlationId || 'unknown',
      status: 'success',
      result: {
        fetchRequestId: fetchRequest.id,
        totalPlans: result.plans.length,
        successfulVendors: result.successfulVendors,
        failedVendors: result.failedVendors,
        plans: result.plans.map(p => ({
          id: p.id,
          vendorName: p.vendorName,
          planName: p.planName,
          premium: p.annualPremium,
        })),
      },
    });

    context.log(`[PIPELINE ACTION] ✓ fetch_plans completed successfully`);
    context.log(`[PIPELINE ACTION] Published service.fetch_plans.completed event`);
  } catch (error: any) {
    context.error(`[PIPELINE ACTION] ✗ fetch_plans failed:`, error);
    context.error(`[PIPELINE ACTION] Error message: ${error.message}`);
    context.error(`[PIPELINE ACTION] Error stack:`, error.stack);
    
    // Publish failure completion event
    try {
      await publishServiceCompletion({
        instanceId: instanceId || 'unknown',
        leadId: leadId || 'unknown',
        actionCompleted: 'fetch_plans',
        serviceName: 'quotation-generation-service',
        correlationId: metadata?.correlationId || 'unknown',
        status: 'failure',
        error: {
          code: 'FETCH_FAILED',
          message: error.message || 'Unknown error',
          retryable: true,
        },
      });
      context.log(`[PIPELINE ACTION] Published service.fetch_plans.failed event`);
    } catch (publishError: any) {
      context.error(`[PIPELINE ACTION] Failed to publish failure event:`, publishError.message);
    }

    // Don't throw - Event Grid will not retry if we throw
    // Pipeline service will handle timeout
  }
}

// Register Event Grid trigger
app.eventGrid('HandleFetchPlansAction', {
  handler: handleFetchPlansAction,
});
