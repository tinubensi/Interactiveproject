/**
 * Event Grid Trigger Handler
 * 
 * Listens for events from Azure Event Grid and triggers matching workflows.
 * This is the main entry point for event-driven workflow execution.
 */

import { app, EventGridEvent, InvocationContext } from '@azure/functions';
import {
  getActiveTriggersForEvent,
  evaluateEventFilter,
  extractVariablesFromEvent
} from '../../lib/repositories/triggerRepository';
import { 
  createInstance,
  CreateInstanceParams 
} from '../../lib/repositories/instanceRepository';
import { getWorkflowByVersion, getWorkflow } from '../../lib/repositories/workflowRepository';
import { executeWorkflow } from '../../lib/engine/workflowOrchestrator';
import { 
  publishWorkflowInstanceStartedEvent 
} from '../../lib/eventPublisher';
import { WorkflowDefinition, EventTriggerConfig } from '../../models/workflowTypes';

/**
 * Event data structure for lead.created events
 */
interface LeadCreatedEventData {
  leadId: string;
  referenceId?: string;
  customerId: string;
  lineOfBusiness?: 'medical' | 'motor' | 'general' | 'marine';
  businessType?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  formId?: string;
  formData?: Record<string, unknown>;
  lobData?: Record<string, unknown>;
  assignedTo?: string;
  createdAt: string;
}

/**
 * Main Event Grid handler
 * Receives events and triggers matching workflows
 */
const eventGridHandler = async (
  event: EventGridEvent,
  context: InvocationContext
): Promise<void> => {
  const eventType = event.eventType;
  const eventData = event.data as Record<string, unknown>;

  context.log(`Received event: ${eventType}`, {
    eventId: event.id,
    subject: event.subject,
    eventTime: event.eventTime
  });

  try {
    // Find all active triggers for this event type
    const triggers = await getActiveTriggersForEvent(eventType);
    
    if (triggers.length === 0) {
      context.log(`No active triggers found for event type: ${eventType}`);
      return;
    }

    context.log(`Found ${triggers.length} trigger(s) for event type: ${eventType}`);

    // Process each matching trigger
    for (const trigger of triggers) {
      try {
        // Check if event matches the filter
        if (!evaluateEventFilter(eventData, trigger.eventFilter)) {
          context.log(`Event did not match filter for trigger ${trigger.triggerId}`);
          continue;
        }

        // Get the workflow definition
        let workflow: WorkflowDefinition;
        try {
          workflow = trigger.workflowVersion
            ? await getWorkflowByVersion(trigger.workflowId, trigger.workflowVersion)
            : await getWorkflow(trigger.workflowId);
        } catch (error) {
          context.error(`Failed to get workflow ${trigger.workflowId}:`, error);
          continue;
        }

        // Check if workflow is active
        if (workflow.status !== 'active') {
          context.warn(`Workflow ${trigger.workflowId} is not active (status: ${workflow.status})`);
          continue;
        }

        // Extract variables from event data
        const extractedVariables = extractVariablesFromEvent(
          eventData,
          trigger.extractVariables
        );

        // Get lead-specific fields if this is a lead event
        const leadId = extractedVariables.leadId as string | undefined 
          || eventData.leadId as string | undefined;
        const customerId = extractedVariables.customerId as string | undefined 
          || eventData.customerId as string | undefined;
        const lineOfBusiness = extractedVariables.lineOfBusiness as 'medical' | 'motor' | 'general' | 'marine' | undefined
          || eventData.lineOfBusiness as 'medical' | 'motor' | 'general' | 'marine' | undefined;

        // Get default variables from workflow definition
        const defaultVariables: Record<string, unknown> = {};
        if (workflow.variables) {
          for (const [key, def] of Object.entries(workflow.variables)) {
            if (def.defaultValue !== undefined) {
              defaultVariables[key] = def.defaultValue;
            }
          }
        }

        // Create workflow instance
        const instanceParams: CreateInstanceParams = {
          workflowId: workflow.workflowId,
          workflowVersion: workflow.version,
          workflowName: workflow.name,
          organizationId: workflow.organizationId,
          triggerId: trigger.triggerId,
          triggerType: 'event',
          triggerData: {
            eventId: event.id,
            eventType: event.eventType,
            subject: event.subject,
            eventTime: event.eventTime,
            data: eventData
          },
          variables: {
            ...defaultVariables,
            ...extractedVariables,
            // Make event data available as 'input'
            input: eventData
          },
          correlationId: event.id,
          initiatedBy: 'event-trigger',
          // Lead-specific fields
          leadId,
          customerId,
          lineOfBusiness
        };

        const instance = await createInstance(instanceParams);

        context.log(`Created workflow instance ${instance.instanceId} for workflow ${workflow.workflowId}`, {
          leadId,
          customerId,
          triggerId: trigger.triggerId
        });

        // Publish instance started event
        await publishWorkflowInstanceStartedEvent(instance);

        // Execute workflow asynchronously
        // In production, this could be queued for execution
        executeWorkflow(instance.instanceId, {
          onStepStart: async (stepId, stepName) => {
            context.log(`Step started: ${stepName} (${stepId})`);
          },
          onStepComplete: async (stepId, result) => {
            context.log(`Step completed: ${stepId}`, { success: result.success });
          },
          onError: async (stepId, error) => {
            context.error(`Step error: ${stepId}`, error);
          }
        }).catch(error => {
          context.error(`Workflow execution failed for instance ${instance.instanceId}:`, error);
        });

      } catch (triggerError) {
        context.error(`Error processing trigger ${trigger.triggerId}:`, triggerError);
        // Continue with other triggers
      }
    }
  } catch (error) {
    context.error('Error handling event:', error);
    throw error; // Re-throw to mark the event as failed
  }
};

/**
 * Register the Event Grid trigger
 * This will receive all events sent to the configured Event Grid topic
 */
app.eventGrid('WorkflowEventTrigger', {
  handler: eventGridHandler
});

/**
 * HTTP endpoint to manually simulate an event trigger (for testing)
 * POST /api/triggers/simulate
 */
import { HttpRequest, HttpResponseInit } from '@azure/functions';
import { handlePreflight } from '../../lib/utils/corsHelper';
import { 
  successResponse, 
  badRequestResponse, 
  handleError 
} from '../../lib/utils/httpResponses';
import { ensureAuthorized, WORKFLOW_PERMISSIONS, requirePermission } from '../../lib/utils/auth';

const simulateHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, WORKFLOW_PERMISSIONS.WORKFLOWS_EXECUTE);

    const body = await request.json() as {
      eventType: string;
      subject?: string;
      data: Record<string, unknown>;
    };

    if (!body.eventType || !body.data) {
      return badRequestResponse('eventType and data are required', undefined, request);
    }

    // Create a simulated Event Grid event
    const simulatedEvent: EventGridEvent = {
      id: `sim-${Date.now()}`,
      eventType: body.eventType,
      subject: body.subject || `/simulated/${body.eventType}`,
      eventTime: new Date().toISOString(),
      data: body.data,
      dataVersion: '1.0',
      topic: '/subscriptions/simulated',
      metadataVersion: '1'
    };

    context.log(`Simulating event: ${body.eventType}`);

    // Process the event
    await eventGridHandler(simulatedEvent, context);

    return successResponse({
      message: 'Event simulated successfully',
      eventId: simulatedEvent.id,
      eventType: body.eventType
    }, request);
  } catch (error) {
    context.error('Error simulating event:', error);
    return handleError(error, request);
  }
};

app.http('SimulateEventTrigger', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'triggers/simulate',
  handler: simulateHandler
});

/**
 * HTTP endpoint to list registered triggers
 * GET /api/triggers
 */
const listTriggersHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    await ensureAuthorized(request);

    const eventType = request.query.get('eventType');
    
    if (eventType) {
      const triggers = await getActiveTriggersForEvent(eventType);
      return successResponse({
        eventType,
        count: triggers.length,
        triggers: triggers.map(t => ({
          triggerId: t.triggerId,
          workflowId: t.workflowId,
          workflowVersion: t.workflowVersion,
          organizationId: t.organizationId,
          isActive: t.isActive,
          eventFilter: t.eventFilter,
          createdAt: t.createdAt
        }))
      }, request);
    }

    // If no eventType specified, return a message
    return successResponse({
      message: 'Provide eventType query parameter to list triggers',
      example: '/api/triggers?eventType=lead.created'
    }, request);
  } catch (error) {
    context.error('Error listing triggers:', error);
    return handleError(error, request);
  }
};

app.http('ListTriggers', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'triggers',
  handler: listTriggersHandler
});

