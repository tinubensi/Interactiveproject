/**
 * Lead Workflow Status API
 * 
 * Provides endpoints to retrieve workflow status and history for leads.
 * Used by the CRM UI to show lead progress through the workflow.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import {
  getInstanceByLeadId,
  getLeadWorkflowStatus,
  getInstanceHistoryByLeadId,
  listActiveLeadInstances,
  LeadWorkflowStatus
} from '../../lib/repositories/instanceRepository';
import { getWorkflowByVersion } from '../../lib/repositories/workflowRepository';
import { 
  successResponse, 
  notFoundResponse, 
  badRequestResponse,
  handleError 
} from '../../lib/utils/httpResponses';
import { handlePreflight } from '../../lib/utils/corsHelper';
import { ensureAuthorized, getUserFromRequest } from '../../lib/utils/auth';
import { WorkflowStep } from '../../models/workflowTypes';

/**
 * Step summary for UI display
 */
interface StepSummary {
  id: string;
  name: string;
  type: string;
  order: number;
  description?: string;
  isCompleted: boolean;
  isCurrent: boolean;
  isEnabled: boolean;
}

/**
 * Extended workflow status with step details
 */
interface ExtendedWorkflowStatus extends LeadWorkflowStatus {
  workflowId?: string;
  workflowName?: string;
  nextStep?: {
    id: string;
    name: string;
    type: string;
    description?: string;
  } | null;
  allSteps?: StepSummary[];
  waitingFor?: string;
}

/**
 * Get workflow status for a specific lead
 * 
 * GET /api/leads/{leadId}/workflow-status
 * 
 * Returns:
 * - Current stage and progress
 * - Completed steps
 * - Next step information
 * - Activity log
 */
const statusHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    await ensureAuthorized(request);
    
    const leadId = request.params.leadId;
    if (!leadId) {
      return badRequestResponse('Lead ID is required', undefined, request);
    }

    context.log(`Getting workflow status for lead: ${leadId}`);

    // Get basic status
    const status = await getLeadWorkflowStatus(leadId);
    
    if (!status) {
      return notFoundResponse('Workflow instance for lead', request);
    }

    // Build extended status with workflow details
    const extendedStatus: ExtendedWorkflowStatus = { ...status };

    // Get the workflow instance to access workflow definition
    const instance = await getInstanceByLeadId(leadId);
    if (instance) {
      try {
        const workflow = await getWorkflowByVersion(
          instance.workflowId, 
          instance.workflowVersion
        );
        
        extendedStatus.workflowId = workflow.workflowId;
        extendedStatus.workflowName = workflow.name;
        
        // Sort steps by order
        const sortedSteps = [...workflow.steps].sort((a, b) => a.order - b.order);
        
        // Find current step index
        const currentStepIndex = sortedSteps.findIndex(
          s => s.id === instance.currentStepId
        );
        
        // Find next step
        const nextStep = currentStepIndex >= 0 && currentStepIndex < sortedSteps.length - 1 
          ? sortedSteps[currentStepIndex + 1] 
          : null;

        extendedStatus.nextStep = nextStep ? {
          id: nextStep.id,
          name: nextStep.name,
          type: nextStep.type,
          description: nextStep.description
        } : null;

        // Build step summaries
        extendedStatus.allSteps = sortedSteps.map((step: WorkflowStep) => ({
          id: step.id,
          name: step.name,
          type: step.type,
          order: step.order,
          description: step.description,
          isCompleted: instance.completedStepIds.includes(step.id),
          isCurrent: step.id === instance.currentStepId,
          isEnabled: step.isEnabled !== false
        }));

        // Update total steps count with accurate number
        extendedStatus.totalSteps = sortedSteps.length;

        // Add waiting reason if applicable
        if (instance.status === 'waiting' && instance.currentStepId) {
          const currentStep = sortedSteps.find(s => s.id === instance.currentStepId);
          if (currentStep) {
            if (currentStep.type === 'wait' && currentStep.waitConfig) {
              extendedStatus.waitingFor = `Waiting for ${currentStep.waitConfig.type === 'event' 
                ? `event: ${(currentStep.waitConfig as { eventType?: string }).eventType || 'external event'}` 
                : 'external trigger'}`;
            } else if (currentStep.type === 'human') {
              extendedStatus.waitingFor = 'Waiting for approval';
            }
          }
        }
      } catch (workflowError) {
        // Workflow definition might have been deleted - continue without it
        context.warn(`Could not load workflow definition: ${workflowError}`);
      }
    }

    return successResponse(extendedStatus, request);
  } catch (error) {
    context.error('Error getting lead workflow status', error);
    return handleError(error, request);
  }
};

app.http('getLeadWorkflowStatus', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'leads/{leadId}/workflow-status',
  handler: statusHandler
});

/**
 * Get workflow history for a lead (all instances)
 * 
 * GET /api/leads/{leadId}/workflow-history
 * 
 * Returns all workflow instances for a lead, including completed and failed ones.
 */
const historyHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    await ensureAuthorized(request);
    
    const leadId = request.params.leadId;
    if (!leadId) {
      return badRequestResponse('Lead ID is required', undefined, request);
    }

    context.log(`Getting workflow history for lead: ${leadId}`);

    const instances = await getInstanceHistoryByLeadId(leadId);
    
    return successResponse({
      leadId,
      totalInstances: instances.length,
      instances: instances.map(inst => ({
        instanceId: inst.instanceId,
        workflowId: inst.workflowId,
        workflowName: inst.workflowName,
        workflowVersion: inst.workflowVersion,
        status: inst.status,
        currentStageName: inst.currentStageName,
        progressPercent: inst.progressPercent,
        stepsCompleted: inst.completedStepIds.length,
        createdAt: inst.createdAt,
        startedAt: inst.startedAt,
        completedAt: inst.completedAt,
        triggeredBy: inst.triggerType,
        lastError: inst.lastError ? {
          code: inst.lastError.code,
          message: inst.lastError.message,
          stepId: inst.lastError.stepId
        } : undefined
      }))
    }, request);
  } catch (error) {
    context.error('Error getting lead workflow history', error);
    return handleError(error, request);
  }
};

app.http('getLeadWorkflowHistory', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'leads/{leadId}/workflow-history',
  handler: historyHandler
});

/**
 * List all active lead workflows
 * 
 * GET /api/leads/workflows/active
 * 
 * Query params:
 * - lineOfBusiness: Filter by line of business (medical, motor, general, marine)
 * 
 * Returns all active (non-completed) workflow instances for leads.
 * Useful for dashboard views.
 */
const activeListHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    
    // Get organization from user context or query param
    const organizationId = request.query.get('organizationId') || userContext.organizationId;
    
    if (!organizationId) {
      return badRequestResponse('Organization ID is required', undefined, request);
    }

    const lineOfBusiness = request.query.get('lineOfBusiness') as 'medical' | 'motor' | 'general' | 'marine' | undefined;

    context.log(`Listing active lead workflows for org: ${organizationId}`);

    const instances = await listActiveLeadInstances(organizationId, lineOfBusiness);
    
    return successResponse({
      totalActive: instances.length,
      instances: instances.map(inst => ({
        instanceId: inst.instanceId,
        leadId: inst.leadId,
        customerId: inst.customerId,
        workflowName: inst.workflowName,
        lineOfBusiness: inst.lineOfBusiness,
        status: inst.status,
        currentStageName: inst.currentStageName,
        progressPercent: inst.progressPercent,
        currentStepId: inst.currentStepId,
        createdAt: inst.createdAt,
        startedAt: inst.startedAt,
        lastActivity: inst.activityLog?.[inst.activityLog.length - 1]
      }))
    }, request);
  } catch (error) {
    context.error('Error listing active lead workflows', error);
    return handleError(error, request);
  }
};

app.http('listActiveLeadWorkflows', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'leads/workflows/active',
  handler: activeListHandler
});

