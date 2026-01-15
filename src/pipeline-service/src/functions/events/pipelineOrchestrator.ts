/**
 * Pipeline Orchestrator Event Handler
 * Listens to Event Grid events and orchestrates pipeline execution
 */

import { app, EventGridEvent, InvocationContext, HttpRequest, HttpResponseInit } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { processEvent, EventData } from '../../lib/orchestrator';
import { PIPELINE_EVENTS } from '../../constants/predefined';
import { handlePreflight, successResponse, errorResponse } from '../../utils/corsHelper';

// In-memory cache for event deduplication
// Maps event ID to timestamp of last processing
const processedEvents = new Map<string, number>();
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Cleanup old entries periodically (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [eventId, timestamp] of processedEvents.entries()) {
    if (now - timestamp > DEDUP_WINDOW_MS) {
      processedEvents.delete(eventId);
    }
  }
}, 10 * 60 * 1000);

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
 * Azure Functions v4 Event Grid triggers can send arrays of events
 */
async function pipelineEventHandler(
  event: EventGridEvent | EventGridEvent[],
  context: InvocationContext
): Promise<void> {
  try {
    context.log('Pipeline Orchestrator received Event Grid event(s)');
    context.log('Event payload:', JSON.stringify(event, null, 2));
    
    // Azure Functions v4 receives Event Grid events as an array
    // The event might be: [event] or { data: [event] } or just the event object
    let events: EventGridEvent[] = [];
    
    if (Array.isArray(event)) {
      events = event;
    } else if ((event as any).data && Array.isArray((event as any).data)) {
      events = (event as any).data;
    } else {
      // Single event object
      events = [event as EventGridEvent];
    }

    context.log(`Processing ${events.length} event(s)`);

    // Process each event
    for (const evt of events) {
      await processSingleEvent(evt, context);
    }
  } catch (error) {
    context.error('Fatal error in pipelineEventHandler:', error);
    // Rethrow to let Event Grid retry
    throw error;
  }
}

/**
 * Process a single Event Grid event
 */
async function processSingleEvent(
  event: EventGridEvent,
  context: InvocationContext,
  requestId?: string
): Promise<void> {
  const eventId = event.id;
  // Use requestId if provided, otherwise use eventId for deduplication
  const dedupKey = requestId || eventId;
  const now = Date.now();
  
  // Check if event was recently processed
  const lastProcessed = processedEvents.get(dedupKey);
  if (lastProcessed && (now - lastProcessed) < DEDUP_WINDOW_MS) {
    const timeSinceProcessed = Math.round((now - lastProcessed) / 1000);
    context.log(`[EVENT DEDUP] Event ${dedupKey} (eventId: ${eventId}) was processed ${timeSinceProcessed}s ago - skipping duplicate`);
    return;
  }
  
  // Mark as processed
  processedEvents.set(dedupKey, now);
  
  // Clean up old entries (older than dedup window)
  // Only clean up occasionally to avoid performance impact
  if (processedEvents.size > 1000) {
    for (const [id, timestamp] of processedEvents.entries()) {
      if (now - timestamp > DEDUP_WINDOW_MS) {
        processedEvents.delete(id);
      }
    }
  }

  const eventType = event.eventType;
  const eventData = event.data as Record<string, unknown>;

  context.log(`Processing event: ${eventType}`);
  context.log(`Event ID: ${event.id}, Subject: ${event.subject}`);
  context.log(`Event data: ${JSON.stringify(eventData, null, 2)}`);

  // Check if this is a relevant event
  if (!(PIPELINE_EVENTS as readonly string[]).includes(eventType)) {
    context.log(`Event type ${eventType} is not handled by pipeline orchestrator`);
    return;
  }

  // Extract required data
  const leadId = extractLeadId(eventData);
  if (!leadId) {
    const errorMsg = `Event ${eventType} has no leadId - cannot process. Event data: ${JSON.stringify(eventData)}`;
    context.error(errorMsg);
    // Don't throw for missing leadId - log and skip
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
    context.log(`[PIPELINE ORCHESTRATOR] Processing event ${eventType} for lead ${leadId} (requestId: ${requestId || eventId})`);
    context.log(`[PIPELINE ORCHESTRATOR] Event data keys: ${Object.keys(orchestratorEventData).join(', ')}`);
    
    const result = await processEvent(eventType, orchestratorEventData, {
      log: context.log.bind(context),
    }, requestId || eventId);

    if (result.processed) {
      context.log(`[PIPELINE ORCHESTRATOR] ✓ Event ${eventType} processed successfully: ${result.action}`);
      if (result.instanceId) {
        context.log(`[PIPELINE ORCHESTRATOR] Instance ID: ${result.instanceId}`);
      }
    } else {
      const errorMsg = result.error || 'no action taken';
      context.warn(`[PIPELINE ORCHESTRATOR] ⚠ Event ${eventType} not processed: ${errorMsg}`);
      
      // Don't throw for "no action taken" - this is expected in some cases
      if (errorMsg && !errorMsg.includes('no action taken') && !errorMsg.includes('no action')) {
        // For other errors, log but don't throw - allow pipeline to continue
        context.error(`[PIPELINE ORCHESTRATOR] ✗ Event processing returned error: ${errorMsg}`);
        context.error(`[PIPELINE ORCHESTRATOR] This may indicate an issue with the pipeline instance state`);
      } else {
        context.log(`[PIPELINE ORCHESTRATOR] Event ${eventType} skipped (no action needed)`);
      }
    }
  } catch (error) {
    context.error(`[PIPELINE ORCHESTRATOR] ✗ Fatal error processing event ${eventType} for lead ${leadId}:`, error);
    context.error(`[PIPELINE ORCHESTRATOR] Error details:`, error);
    // Rethrow to let Event Grid retry the event
    throw error;
  }
}

// Register the Event Grid trigger
app.eventGrid('PipelineOrchestrator', {
  handler: pipelineEventHandler,
});

/**
 * HTTP endpoint for pipeline event processing (Event Grid fallback)
 *
 * Purpose: HTTP fallback for all pipeline events when Event Grid fails
 * POST /api/pipeline/process-event
 *
 * Authentication: Uses 'x-service-key' header if INTERNAL_SERVICE_KEY is set
 *
 * Request Body:
 * {
 *   eventType: string (e.g., 'plans.fetch_completed', 'quotation.created', 'quotation.sent')
 *   leadId: string (required)
 *   lineOfBusiness?: string
 *   data?: Record<string, unknown> (additional event data)
 * }
 *
 * Event Examples:
 *
 * 1. plans.fetch_completed:
 * {
 *   eventType: 'plans.fetch_completed',
 *   leadId: 'lead-123',
 *   lineOfBusiness: 'medical',
 *   businessType: 'individual',
 *   data: {
 *     fetchRequestId: 'fetch-456',
 *     totalPlans: 5,
 *     successfulVendors: ['vendor1', 'vendor2'],
 *     failedVendors: []
 *   }
 * }
 *
 * 2. quotation.created:
 * {
 *   eventType: 'quotation.created',
 *   leadId: 'lead-123',
 *   lineOfBusiness: 'medical',
 *   data: {
 *     quotationId: 'quot-789',
 *     referenceId: 'Q-2024-001',
 *     customerId: 'cust-123',
 *     totalPremium: 2500,
 *     planCount: 3,
 *     version: 1,
 *     planIds: ['plan-1', 'plan-2', 'plan-3']
 *   }
 * }
 *
 * 3. quotation.sent:
 * {
 *   eventType: 'quotation.sent',
 *   leadId: 'lead-123',
 *   lineOfBusiness: 'medical',
 *   data: {
 *     quotationId: 'quot-789',
 *     recipientEmail: 'customer@example.com',
 *     pdfUrl: 'https://storage.example.com/quotation.pdf'
 *   }
 * }
 *
 * Response: { message: string, processed: boolean, instanceId?: string, action?: string, error?: string }
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
      requestId?: string; // Optional request ID for deduplication
      data?: Record<string, unknown>;
    };

    if (!body.eventType || !body.leadId) {
      return errorResponse(request, 'eventType and leadId are required', 400);
    }

    // Generate request ID if not provided (for backward compatibility)
    const requestId = body.requestId || uuidv4();

    context.log(`[HTTP FALLBACK] Manual event processing: ${body.eventType} for lead ${body.leadId} (requestId: ${requestId})`);
    context.log(`[HTTP FALLBACK] Event data keys: ${Object.keys(body.data || {}).join(', ')}`);

    const eventData: EventData = {
      ...body.data,
      leadId: body.leadId,
      lineOfBusiness: body.lineOfBusiness as EventData['lineOfBusiness'],
    };

    context.log(`[HTTP FALLBACK] Prepared event data with leadId: ${eventData.leadId}, lineOfBusiness: ${eventData.lineOfBusiness}`);

    const result = await processEvent(body.eventType, eventData, {
      log: context.log.bind(context),
    }, requestId);

    context.log(`[HTTP FALLBACK] Event processing result: processed=${result.processed}, action=${result.action || 'none'}, error=${result.error || 'none'}`);

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

    if (!instance) {
      return successResponse(request, {
        leadId,
        hasActivePipeline: false,
        instance: null,
        diagnostics: {
          message: 'No active pipeline instance found for this lead',
          checks: {
            progressIsZero: null,
            stageNotSet: null,
            notWaitingForEvent: null,
          },
        },
      });
    }

    // Diagnostic checks
    const diagnostics = {
      message: 'Pipeline instance found',
      checks: {
        progressIsZero: {
          status: instance.progressPercent === 0 ? 'ISSUE' : 'OK',
          value: instance.progressPercent,
          expected: '> 0%',
          description: instance.progressPercent === 0 
            ? 'Progress is 0% - this indicates the instance was created before the fix or there was an issue during creation'
            : `Progress is ${instance.progressPercent}% (correct)`,
        },
        stageNotSet: {
          status: (instance.currentStepType === 'stage' && !instance.currentStageName) ? 'ISSUE' : 'OK',
          value: instance.currentStageName || 'NOT SET',
          expected: instance.currentStepType === 'stage' ? 'Stage name should be set' : 'N/A (not a stage step)',
          description: instance.currentStepType === 'stage' && !instance.currentStageName
            ? 'Current step is a stage but stage name is not set'
            : instance.currentStageName 
              ? `Current stage: ${instance.currentStageName}`
              : 'Current step is not a stage',
        },
        notWaitingForEvent: {
          status: !instance.waitingForEvent && instance.nextStepType === 'stage' ? 'WARNING' : 'OK',
          value: instance.waitingForEvent || 'NOT SET',
          expected: instance.nextStepType === 'stage' ? 'Should be waiting for next stage trigger event' : 'May not need to wait',
          description: !instance.waitingForEvent && instance.nextStepType === 'stage'
            ? 'Next step is a stage but not waiting for its trigger event'
            : instance.waitingForEvent
              ? `Waiting for: ${instance.waitingForEvent}`
              : 'Not waiting for an event (may be OK if next step is not a stage)',
        },
        completedStepsCount: {
          status: instance.completedStepsCount === 0 ? 'ISSUE' : 'OK',
          value: instance.completedStepsCount,
          expected: '>= 1',
          description: instance.completedStepsCount === 0
            ? 'Completed steps count is 0 - should be at least 1 when instance is created'
            : `Completed ${instance.completedStepsCount} of ${instance.totalStepsCount} steps`,
        },
      },
      summary: {
        allChecksPass: 
          instance.progressPercent > 0 &&
          (instance.currentStepType !== 'stage' || !!instance.currentStageName) &&
          instance.completedStepsCount > 0,
        issues: [
          instance.progressPercent === 0 && 'Progress is 0%',
          instance.currentStepType === 'stage' && !instance.currentStageName && 'Stage name not set',
          instance.completedStepsCount === 0 && 'Completed steps count is 0',
        ].filter(Boolean) as string[],
      },
    };

    return successResponse(request, {
      leadId,
      hasActivePipeline: true,
      instance: {
        instanceId: instance.instanceId,
        pipelineId: instance.pipelineId,
        pipelineName: instance.pipelineName,
        status: instance.status,
        currentStepId: instance.currentStepId,
        currentStepType: instance.currentStepType,
        currentStageName: instance.currentStageName,
        currentStageId: instance.currentStageId,
        progressPercent: instance.progressPercent,
        completedStepsCount: instance.completedStepsCount,
        totalStepsCount: instance.totalStepsCount,
        waitingForEvent: instance.waitingForEvent,
        waitingForApprovalId: instance.waitingForApprovalId,
        nextStepId: instance.nextStepId,
        nextStepType: instance.nextStepType,
        nextStageName: instance.nextStageName,
        createdAt: instance.createdAt,
        updatedAt: instance.updatedAt,
      },
      diagnostics,
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
