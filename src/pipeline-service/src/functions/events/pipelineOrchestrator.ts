/**
 * Pipeline Orchestrator Event Handler
 * Listens to Event Grid events and orchestrates pipeline execution
 */

import { app, EventGridEvent, InvocationContext, HttpRequest, HttpResponseInit } from '@azure/functions';
import { processEvent, EventData } from '../../lib/orchestrator';
import { PIPELINE_EVENTS } from '../../constants/predefined';
import { handlePreflight, successResponse, errorResponse } from '../../utils/corsHelper';

/**
 * Extract lead ID from various event data formats
 */
function extractLeadId(eventData: Record<string, unknown>): string | undefined {
  // Try common field names
  return (
    eventData.leadId ||
    eventData.lead_id ||
    eventData.LeadId ||
    (eventData.data as Record<string, unknown>)?.leadId
  ) as string | undefined;
}

/**
 * Extract line of business from event data
 */
function extractLineOfBusiness(eventData: Record<string, unknown>): string | undefined {
  return (
    eventData.lineOfBusiness ||
    eventData.line_of_business ||
    eventData.lob ||
    (eventData.data as Record<string, unknown>)?.lineOfBusiness
  ) as string | undefined;
}

/**
 * Main Event Grid handler for pipeline orchestration
 */
async function pipelineEventHandler(
  event: EventGridEvent,
  context: InvocationContext
): Promise<void> {
  const eventType = event.eventType;
  const eventData = event.data as Record<string, unknown>;

  context.log(`Pipeline Orchestrator received event: ${eventType}`);
  context.log(`Event ID: ${event.id}, Subject: ${event.subject}`);

  // Check if this is a relevant event
  if (!PIPELINE_EVENTS.includes(eventType)) {
    context.log(`Event type ${eventType} is not handled by pipeline orchestrator`);
    return;
  }

  // Extract required data
  const leadId = extractLeadId(eventData);
  if (!leadId) {
    context.log(`Event ${eventType} has no leadId - skipping`);
    return;
  }

  const lineOfBusiness = extractLineOfBusiness(eventData);

  // Prepare event data for orchestrator
  const orchestratorEventData: EventData = {
    ...eventData,
    leadId,
    lineOfBusiness: lineOfBusiness as EventData['lineOfBusiness'],
  };

  // Process the event
  try {
    const result = await processEvent(eventType, orchestratorEventData, {
      log: context.log.bind(context),
    });

    if (result.processed) {
      context.log(`Event ${eventType} processed successfully: ${result.action}`);
      if (result.instanceId) {
        context.log(`Instance ID: ${result.instanceId}`);
      }
    } else {
      context.log(`Event ${eventType} not processed: ${result.error || 'no action taken'}`);
    }
  } catch (error) {
    context.error(`Error processing event ${eventType}:`, error);
    // Don't rethrow - we don't want to fail the event delivery
  }
}

// Register the Event Grid trigger
app.eventGrid('PipelineOrchestrator', {
  handler: pipelineEventHandler,
});

/**
 * HTTP endpoint to manually trigger pipeline processing (for testing)
 * POST /api/pipeline/process-event
 */
async function manualProcessEventHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const body = await request.json() as {
      eventType: string;
      leadId: string;
      lineOfBusiness?: string;
      data?: Record<string, unknown>;
    };

    if (!body.eventType || !body.leadId) {
      return errorResponse(request, 'eventType and leadId are required', 400);
    }

    context.log(`Manual event processing: ${body.eventType} for lead ${body.leadId}`);

    const eventData: EventData = {
      ...body.data,
      leadId: body.leadId,
      lineOfBusiness: body.lineOfBusiness as EventData['lineOfBusiness'],
    };

    const result = await processEvent(body.eventType, eventData, {
      log: context.log.bind(context),
    });

    return successResponse(request, {
      message: result.processed ? 'Event processed successfully' : 'Event not processed',
      ...result,
    });
  } catch (error) {
    context.error('Error in manual event processing:', error);
    return errorResponse(request, String(error), 500);
  }
}

app.http('ManualProcessEvent', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'pipeline/process-event',
  handler: manualProcessEventHandler,
});

/**
 * HTTP endpoint to check if a lead has an active pipeline
 * GET /api/pipeline/check/:leadId
 */
import { getInstanceByLeadId } from '../../repositories/instanceRepository';

async function checkPipelineHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const leadId = request.params.leadId;
    if (!leadId) {
      return errorResponse(request, 'leadId is required', 400);
    }

    const instance = await getInstanceByLeadId(leadId);

    return successResponse(request, {
      leadId,
      hasActivePipeline: !!instance,
      instance: instance ? {
        instanceId: instance.instanceId,
        pipelineId: instance.pipelineId,
        pipelineName: instance.pipelineName,
        status: instance.status,
        currentStepId: instance.currentStepId,
        currentStepType: instance.currentStepType,
        currentStageName: instance.currentStageName,
        progressPercent: instance.progressPercent,
      } : null,
    });
  } catch (error) {
    context.error('Error checking pipeline:', error);
    return errorResponse(request, String(error), 500);
  }
}

app.http('CheckPipeline', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'pipeline/check/{leadId}',
  handler: checkPipelineHandler,
});

