/**
 * Insurance-Specific Step Executor
 * Handles all insurance-related workflow actions
 * 
 * This executor tracks lead progress and activity logs for each action.
 * 
 * @deprecated This executor is deprecated. Use the Pipeline Service for lead
 * stage management instead. The Pipeline Service provides a simpler, more
 * maintainable approach with predefined stages and actions.
 * 
 * See: /nectaria-services/src/pipeline-service
 * 
 * The workflow service should be used for general-purpose automation tasks,
 * not for insurance-specific lead flow management.
 */

import {
  StepResult,
  ExecutionError
} from '../../models/workflowTypes';
import {
  ExpressionContext,
  resolveTemplate,
  resolveObject
} from '../engine/expressionResolver';
import { executeEventPublish } from './eventPublishExecutor';
import {
  updateLeadProgress,
  addActivityLogEntry
} from '../repositories/instanceRepository';

// =============================================================================
// Execution Context for Progress Tracking
// =============================================================================

/**
 * Context passed to insurance executors for tracking progress
 */
export interface InsuranceExecutionContext {
  /** Workflow instance ID */
  instanceId: string;
  /** Lead ID (if available) */
  leadId?: string;
}

// =============================================================================
// Stage Progress Mapping
// =============================================================================

/**
 * Maps stage names to progress percentages
 */
const STAGE_PROGRESS_MAP: Record<string, number> = {
  'Lead Created': 5,
  'Plans Fetching': 10,
  'Plans Available': 25,
  'Quotation Created': 40,
  'Quotation Sent': 55,
  'Customer Response Pending': 60,
  'Pending Review': 70,
  'Approved': 80,
  'Policy Requested': 85,
  'Policy Pending': 90,
  'Policy Issued': 100,
  'Lost': 100,
  'Cancelled': 100,
  'Rejected': 100,
};

/**
 * Get progress percentage for a stage name
 */
const getProgressForStage = (stageName: string): number => {
  return STAGE_PROGRESS_MAP[stageName] ?? 50;
};

// =============================================================================
// Configuration Interfaces
// =============================================================================

export interface ChangeLeadStageConfig {
  stageId: string;
  stageName: string;
  remark?: string;
  autoTransition?: boolean;
}

export interface AssignLeadConfig {
  assignmentStrategy: 'round-robin' | 'load-balanced' | 'expertise-based' | 'specific-agent';
  agentId?: string;
  teamFilter?: string;
  notifyAgent?: boolean;
}

export interface MarkHotLeadConfig {
  isHotLead: boolean;
  notifyManager?: boolean;
  reason?: string;
}

export interface RefetchPlansConfig {
  clearExisting?: boolean;
  vendorIds?: string[];
}

export interface CreateQuotationConfig {
  planSelectionStrategy: 'all' | 'best-value' | 'cheapest' | 'manual';
  maxPlans?: number;
  planIds?: string[];
  validityDays?: number;
  autoSelectRecommended?: boolean;
  termsAndConditions?: string;
}

export interface SendQuotationConfig {
  recipient: string;
  template?: string;
  generatePdf?: boolean;
  includeComparison?: boolean;
  customMessage?: string;
  ccRecipients?: string[];
  trackOpens?: boolean;
}

export interface ApproveQuotationConfig {
  remarks?: string;
  autoApprove?: boolean;
  notifyCustomer?: boolean;
}

export interface RejectQuotationConfig {
  reason: string;
  remarks?: string;
  notifyCustomer?: boolean;
}

export interface CreatePolicyRequestConfig {
  useSelectedPlan?: boolean;
  planId?: string;
  notifyUnderwriter?: boolean;
  documentIds?: string[];
}

// =============================================================================
// Result Interface
// =============================================================================

export interface InsuranceExecutorResult {
  success: boolean;
  data?: unknown;
  error?: ExecutionError;
}

// =============================================================================
// Service Base URLs (from environment)
// =============================================================================

const getServiceUrls = () => ({
  leadService: process.env.LEAD_SERVICE_URL || 'http://localhost:7078/api',
  quotationService: process.env.QUOTATION_SERVICE_URL || 'http://localhost:7072/api',
  policyService: process.env.POLICY_SERVICE_URL || 'http://localhost:7073/api',
  notificationService: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:7074/api',
});

// =============================================================================
// Helper: Make service call
// =============================================================================

const callService = async (
  url: string,
  method: string,
  body?: unknown
): Promise<{ success: boolean; data?: unknown; error?: ExecutionError }> => {
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error: {
          code: `HTTP_${response.status}`,
          message: `Service call failed: ${response.statusText}`,
          details: data,
        },
      };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'SERVICE_CALL_ERROR',
        message: error instanceof Error ? error.message : 'Service call failed',
      },
    };
  }
};

// =============================================================================
// Action Executors
// =============================================================================

/**
 * Execute: Change Lead Stage
 */
export const executeChangeLeadStage = async (
  config: ChangeLeadStageConfig,
  context: ExpressionContext,
  execContext?: InsuranceExecutionContext
): Promise<InsuranceExecutorResult> => {
  const urls = getServiceUrls();
  const leadId = context.variables.leadId || context.input?.leadId;

  if (!leadId) {
    return {
      success: false,
      error: {
        code: 'MISSING_LEAD_ID',
        message: 'Lead ID is required for stage change',
      },
    };
  }

  const stageId = resolveTemplate(config.stageId, context);
  const stageName = resolveTemplate(config.stageName, context);

  const result = await callService(
    `${urls.leadService}/leads/${leadId}/stage`,
    'POST',
    {
      stageId,
      stageName,
      remark: config.remark,
    }
  );

  if (result.success) {
    // Update workflow instance progress
    if (execContext?.instanceId) {
      const progress = getProgressForStage(stageName);
      await updateLeadProgress(
        execContext.instanceId,
        stageName,
        progress,
        `Stage changed to "${stageName}"${config.remark ? `: ${config.remark}` : ''}`,
        'success',
        'milestone'
      );
    }

    // Publish stage change event
    await executeEventPublish(
      {
        eventType: 'lead.stage_changed',
        subject: `lead/${leadId}`,
        data: {
          leadId,
          newStageId: stageId,
          newStageName: stageName,
          timestamp: new Date().toISOString(),
        },
      },
      context
    );
  }

  return result;
};

/**
 * Execute: Assign Lead to Agent
 */
export const executeAssignLead = async (
  config: AssignLeadConfig,
  context: ExpressionContext,
  execContext?: InsuranceExecutionContext
): Promise<InsuranceExecutorResult> => {
  const urls = getServiceUrls();
  const leadId = context.variables.leadId || context.input?.leadId;

  if (!leadId) {
    return {
      success: false,
      error: {
        code: 'MISSING_LEAD_ID',
        message: 'Lead ID is required for assignment',
      },
    };
  }

  let assigneeId = config.agentId;

  // If not a specific agent, use assignment strategy
  if (config.assignmentStrategy !== 'specific-agent' || !assigneeId) {
    // Call assignment service to get next agent
    const assignmentResult = await callService(
      `${urls.leadService}/assignment/next-agent`,
      'POST',
      {
        strategy: config.assignmentStrategy,
        teamFilter: config.teamFilter,
        leadId,
      }
    );

    if (!assignmentResult.success) {
      return assignmentResult;
    }

    assigneeId = (assignmentResult.data as { agentId: string })?.agentId;
  }

  // Assign the lead
  const result = await callService(
    `${urls.leadService}/leads/${leadId}`,
    'PATCH',
    {
      assignedTo: assigneeId,
    }
  );

  if (result.success) {
    // Log activity
    if (execContext?.instanceId) {
      await addActivityLogEntry(
        execContext.instanceId,
        `Lead assigned to agent (${config.assignmentStrategy} strategy)`,
        'info',
        'user-plus',
        { assigneeId, strategy: config.assignmentStrategy }
      );
    }

    if (config.notifyAgent) {
      // Publish assignment event for notification
      await executeEventPublish(
        {
          eventType: 'lead.assigned',
          subject: `lead/${leadId}`,
          data: {
            leadId,
            assignedTo: assigneeId,
            timestamp: new Date().toISOString(),
          },
        },
        context
      );
    }
  }

  return result;
};

/**
 * Execute: Mark Lead as Hot
 */
export const executeMarkHotLead = async (
  config: MarkHotLeadConfig,
  context: ExpressionContext,
  execContext?: InsuranceExecutionContext
): Promise<InsuranceExecutorResult> => {
  const urls = getServiceUrls();
  const leadId = context.variables.leadId || context.input?.leadId;

  if (!leadId) {
    return {
      success: false,
      error: {
        code: 'MISSING_LEAD_ID',
        message: 'Lead ID is required',
      },
    };
  }

  const result = await callService(
    `${urls.leadService}/leads/${leadId}`,
    'PATCH',
    {
      isHotLead: config.isHotLead,
    }
  );

  if (result.success) {
    // Log activity
    if (execContext?.instanceId) {
      await addActivityLogEntry(
        execContext.instanceId,
        config.isHotLead 
          ? `Lead marked as HOT${config.reason ? `: ${config.reason}` : ''}`
          : 'Lead hot status removed',
        config.isHotLead ? 'warning' : 'info',
        config.isHotLead ? 'flame' : 'thermometer',
        { isHotLead: config.isHotLead, reason: config.reason }
      );
    }

    if (config.notifyManager) {
      await executeEventPublish(
        {
          eventType: 'lead.hot_lead_marked',
          subject: `lead/${leadId}`,
          data: {
            leadId,
            isHotLead: config.isHotLead,
            reason: config.reason,
            timestamp: new Date().toISOString(),
          },
        },
        context
      );
    }
  }

  return result;
};

/**
 * Execute: Refetch Insurance Plans
 */
export const executeRefetchPlans = async (
  config: RefetchPlansConfig,
  context: ExpressionContext,
  execContext?: InsuranceExecutionContext
): Promise<InsuranceExecutorResult> => {
  const urls = getServiceUrls();
  const leadId = context.variables.leadId || context.input?.leadId;

  if (!leadId) {
    return {
      success: false,
      error: {
        code: 'MISSING_LEAD_ID',
        message: 'Lead ID is required for plan refetch',
      },
    };
  }

  // Log activity before fetching
  if (execContext?.instanceId) {
    await addActivityLogEntry(
      execContext.instanceId,
      'Fetching insurance plans from vendors...',
      'info',
      'refresh-cw'
    );
  }

  const result = await callService(
    `${urls.leadService}/leads/${leadId}/refetch-plans`,
    'POST',
    {
      clearExisting: config.clearExisting,
      vendorIds: config.vendorIds,
    }
  );

  // Log result
  if (execContext?.instanceId && result.success) {
    const planCount = (result.data as { plansCount?: number })?.plansCount;
    await addActivityLogEntry(
      execContext.instanceId,
      planCount 
        ? `Plans fetched successfully (${planCount} plans available)`
        : 'Plans fetch request submitted',
      'success',
      'check-circle',
      { plansCount: planCount }
    );
  }

  return result;
};

/**
 * Execute: Create Quotation
 */
export const executeCreateQuotation = async (
  config: CreateQuotationConfig,
  context: ExpressionContext,
  execContext?: InsuranceExecutionContext
): Promise<InsuranceExecutorResult> => {
  const urls = getServiceUrls();
  const leadId = context.variables.leadId || context.input?.leadId;

  if (!leadId) {
    return {
      success: false,
      error: {
        code: 'MISSING_LEAD_ID',
        message: 'Lead ID is required for quotation creation',
      },
    };
  }

  const result = await callService(
    `${urls.quotationService}/quotations`,
    'POST',
    {
      leadId,
      planSelectionStrategy: config.planSelectionStrategy,
      maxPlans: config.maxPlans || 5,
      planIds: config.planIds,
      validityDays: config.validityDays || 30,
      autoSelectRecommended: config.autoSelectRecommended,
      termsAndConditions: config.termsAndConditions,
    }
  );

  if (result.success) {
    const quotationId = (result.data as { id: string })?.id;
    const planCount = (result.data as { planCount?: number })?.planCount;

    // Update progress and log activity
    if (execContext?.instanceId) {
      await updateLeadProgress(
        execContext.instanceId,
        'Quotation Created',
        40,
        `Quotation created${planCount ? ` with ${planCount} plans` : ''} (ID: ${quotationId})`,
        'success',
        'file-text'
      );
    }

    await executeEventPublish(
      {
        eventType: 'quotation.created',
        subject: `quotation/${quotationId}`,
        data: {
          quotationId,
          leadId,
          timestamp: new Date().toISOString(),
        },
      },
      context
    );
  }

  return result;
};

/**
 * Execute: Send Quotation to Customer
 */
export const executeSendQuotation = async (
  config: SendQuotationConfig,
  context: ExpressionContext,
  execContext?: InsuranceExecutionContext
): Promise<InsuranceExecutorResult> => {
  const urls = getServiceUrls();
  const quotationId = context.variables.quotationId || context.input?.quotationId;

  if (!quotationId) {
    return {
      success: false,
      error: {
        code: 'MISSING_QUOTATION_ID',
        message: 'Quotation ID is required',
      },
    };
  }

  const recipient = resolveTemplate(config.recipient, context);

  const result = await callService(
    `${urls.quotationService}/quotations/${quotationId}/send`,
    'POST',
    {
      recipient,
      template: config.template || 'quotation-email',
      generatePdf: config.generatePdf ?? true,
      includeComparison: config.includeComparison ?? true,
      customMessage: config.customMessage,
      ccRecipients: config.ccRecipients,
      trackOpens: config.trackOpens ?? true,
    }
  );

  if (result.success) {
    // Update progress and log activity
    if (execContext?.instanceId) {
      await updateLeadProgress(
        execContext.instanceId,
        'Quotation Sent',
        55,
        `Quotation sent to ${recipient}`,
        'success',
        'mail'
      );
    }

    await executeEventPublish(
      {
        eventType: 'quotation.sent',
        subject: `quotation/${quotationId}`,
        data: {
          quotationId,
          sentTo: recipient,
          timestamp: new Date().toISOString(),
        },
      },
      context
    );
  }

  return result;
};

/**
 * Execute: Approve Quotation
 */
export const executeApproveQuotation = async (
  config: ApproveQuotationConfig,
  context: ExpressionContext,
  execContext?: InsuranceExecutionContext
): Promise<InsuranceExecutorResult> => {
  const urls = getServiceUrls();
  const quotationId = context.variables.quotationId || context.input?.quotationId;

  if (!quotationId) {
    return {
      success: false,
      error: {
        code: 'MISSING_QUOTATION_ID',
        message: 'Quotation ID is required',
      },
    };
  }

  const result = await callService(
    `${urls.quotationService}/quotations/${quotationId}/approve`,
    'POST',
    {
      remarks: config.remarks,
      autoApprove: config.autoApprove,
      notifyCustomer: config.notifyCustomer ?? true,
    }
  );

  if (result.success) {
    // Update progress and log activity
    if (execContext?.instanceId) {
      await updateLeadProgress(
        execContext.instanceId,
        'Approved',
        80,
        `Quotation approved${config.remarks ? `: ${config.remarks}` : ''}`,
        'success',
        'check-circle'
      );
    }

    await executeEventPublish(
      {
        eventType: 'quotation.approved',
        subject: `quotation/${quotationId}`,
        data: {
          quotationId,
          timestamp: new Date().toISOString(),
        },
      },
      context
    );
  }

  return result;
};

/**
 * Execute: Reject Quotation
 */
export const executeRejectQuotation = async (
  config: RejectQuotationConfig,
  context: ExpressionContext,
  execContext?: InsuranceExecutionContext
): Promise<InsuranceExecutorResult> => {
  const urls = getServiceUrls();
  const quotationId = context.variables.quotationId || context.input?.quotationId;

  if (!quotationId) {
    return {
      success: false,
      error: {
        code: 'MISSING_QUOTATION_ID',
        message: 'Quotation ID is required',
      },
    };
  }

  const result = await callService(
    `${urls.quotationService}/quotations/${quotationId}/reject`,
    'POST',
    {
      reason: config.reason,
      remarks: config.remarks,
      notifyCustomer: config.notifyCustomer ?? true,
    }
  );

  if (result.success) {
    // Update progress and log activity
    if (execContext?.instanceId) {
      await updateLeadProgress(
        execContext.instanceId,
        'Rejected',
        100,
        `Quotation rejected: ${config.reason}`,
        'error',
        'x-circle'
      );
    }

    await executeEventPublish(
      {
        eventType: 'quotation.rejected',
        subject: `quotation/${quotationId}`,
        data: {
          quotationId,
          reason: config.reason,
          timestamp: new Date().toISOString(),
        },
      },
      context
    );
  }

  return result;
};

/**
 * Execute: Create Policy Request
 */
export const executeCreatePolicyRequest = async (
  config: CreatePolicyRequestConfig,
  context: ExpressionContext,
  execContext?: InsuranceExecutionContext
): Promise<InsuranceExecutorResult> => {
  const urls = getServiceUrls();
  const quotationId = context.variables.quotationId || context.input?.quotationId;
  const leadId = context.variables.leadId || context.input?.leadId;

  if (!quotationId) {
    return {
      success: false,
      error: {
        code: 'MISSING_QUOTATION_ID',
        message: 'Quotation ID is required for policy request',
      },
    };
  }

  const planId = config.useSelectedPlan
    ? (context.variables.selectedPlanId || context.input?.selectedPlanId)
    : config.planId;

  const result = await callService(
    `${urls.policyService}/policy-requests`,
    'POST',
    {
      quotationId,
      leadId,
      planId,
      documentIds: config.documentIds,
      notifyUnderwriter: config.notifyUnderwriter ?? true,
    }
  );

  if (result.success) {
    const policyRequestId = (result.data as { id: string })?.id;

    // Update progress and log activity
    if (execContext?.instanceId) {
      await updateLeadProgress(
        execContext.instanceId,
        'Policy Requested',
        85,
        `Policy request created (ID: ${policyRequestId})`,
        'success',
        'file-plus'
      );
    }

    await executeEventPublish(
      {
        eventType: 'policy.request_created',
        subject: `policy-request/${policyRequestId}`,
        data: {
          policyRequestId,
          quotationId,
          leadId,
          timestamp: new Date().toISOString(),
        },
      },
      context
    );
  }

  return result;
};

// =============================================================================
// Main Dispatcher
// =============================================================================

/**
 * Execute an insurance-specific action
 * @param actionType - The type of insurance action to execute
 * @param config - Configuration for the action
 * @param context - Expression context with variables and step outputs
 * @param execContext - Optional execution context for progress tracking
 */
export const executeInsuranceAction = async (
  actionType: string,
  config: unknown,
  context: ExpressionContext,
  execContext?: InsuranceExecutionContext
): Promise<StepResult> => {
  let result: InsuranceExecutorResult;

  switch (actionType) {
    case 'change_lead_stage':
      result = await executeChangeLeadStage(
        config as ChangeLeadStageConfig,
        context,
        execContext
      );
      break;

    case 'assign_lead':
      result = await executeAssignLead(
        config as AssignLeadConfig, 
        context,
        execContext
      );
      break;

    case 'mark_hot_lead':
      result = await executeMarkHotLead(
        config as MarkHotLeadConfig, 
        context,
        execContext
      );
      break;

    case 'refetch_plans':
      result = await executeRefetchPlans(
        config as RefetchPlansConfig, 
        context,
        execContext
      );
      break;

    case 'create_quotation':
      result = await executeCreateQuotation(
        config as CreateQuotationConfig,
        context,
        execContext
      );
      break;

    case 'send_quotation':
      result = await executeSendQuotation(
        config as SendQuotationConfig,
        context,
        execContext
      );
      break;

    case 'approve_quotation':
      result = await executeApproveQuotation(
        config as ApproveQuotationConfig,
        context,
        execContext
      );
      break;

    case 'reject_quotation':
      result = await executeRejectQuotation(
        config as RejectQuotationConfig,
        context,
        execContext
      );
      break;

    case 'create_policy_request':
      result = await executeCreatePolicyRequest(
        config as CreatePolicyRequestConfig,
        context,
        execContext
      );
      break;

    default:
      return {
        success: false,
        error: {
          code: 'UNKNOWN_INSURANCE_ACTION',
          message: `Unknown insurance action type: ${actionType}`,
        },
        shouldTerminate: false,
      };
  }

  return insuranceResultToStepResult(result);
};

/**
 * Convert insurance executor result to step result
 */
export const insuranceResultToStepResult = (
  result: InsuranceExecutorResult
): StepResult => {
  return {
    success: result.success,
    output: result.success ? result.data : undefined,
    error: result.error,
    shouldTerminate: false,
  };
};

/**
 * Check if an action type is an insurance action
 */
export const isInsuranceActionType = (actionType: string): boolean => {
  const insuranceActions = [
    'change_lead_stage',
    'assign_lead',
    'mark_hot_lead',
    'refetch_plans',
    'create_quotation',
    'send_quotation',
    'approve_quotation',
    'reject_quotation',
    'create_policy_request',
  ];
  return insuranceActions.includes(actionType);
};

