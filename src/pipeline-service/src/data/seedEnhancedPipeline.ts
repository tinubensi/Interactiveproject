/**
 * Enhanced Medical Pipeline Definition
 * Configuration-driven hybrid sync/async pipeline with action configs
 */

import { v4 as uuidv4 } from 'uuid';
import { PipelineDefinition, EnhancedStageStep, StageStep, DecisionStep, WaitStep } from '../models/pipeline';

export function generateEnhancedMedicalPipeline(): PipelineDefinition {
  const stepIds = {
    leadCreated: uuidv4(),
    plansFetching: uuidv4(),
    plansAvailable: uuidv4(),
    quotationCreated: uuidv4(),
    quotationSent: uuidv4(), // Also used for "Waiting for Customer Response"
    pendingReview: uuidv4(),
    approved: uuidv4(),
    policyRequested: uuidv4(),
    policyIssued: uuidv4(),
    revisionRequested: uuidv4(),
    rejected: uuidv4(),
    lost: uuidv4(),
    cancelled: uuidv4(),
  };

  const steps: Array<StageStep | EnhancedStageStep | DecisionStep | WaitStep> = [
    // Stage 1: Lead Created - ASYNC plan fetching
    {
      id: stepIds.leadCreated,
      order: 1,
      type: 'stage',
      enabled: true,
      stageId: 'lead-created',
      stageName: 'Lead Created',
      actionConfig: {
        primaryAction: {
          type: 'async',
          asyncAction: {
            targetService: 'quotation-gen',
            actionEvent: 'pipeline.action.fetch_plans',
            requiredData: ['leadId', 'lineOfBusiness'],
            completionEvent: 'plans.fetch_completed',
            timeout: 300000, // 5 minutes
            retryPolicy: { maxRetries: 2, retryDelayMs: 60000 },
          },
        },
      },
      metadata: {
        estimatedDuration: 180000,
        requiresUserInput: false,
        canSkip: false,
        exitConditions: ['plans.fetch_completed'],
      },
    } as EnhancedStageStep,

    // Stage 2: Plans Fetching (transitional state)
    {
      id: stepIds.plansFetching,
      order: 2,
      type: 'stage',
      enabled: true,
      stageId: 'plans-fetching',
      stageName: 'Plans Fetching',
      metadata: {
        estimatedDuration: 0,
        requiresUserInput: false,
        canSkip: false,
        exitConditions: [],
      },
    } as StageStep,

    // Stage 3: Plans Available - MANUAL (wait for user)
    {
      id: stepIds.plansAvailable,
      order: 3,
      type: 'stage',
      enabled: true,
      stageId: 'plans-available',
      stageName: 'Plans Available',
      actionConfig: {
        primaryAction: { type: 'manual' },
        allowedUserActions: [
          {
            actionId: 'create_quotation',
            actionName: 'Create Quotation',
            actionType: 'sync',
            requiresApproval: false,
            syncAction: {
              targetService: 'quotation-service',
              endpoint: '/api/quotations',
              method: 'POST',
              requiredData: ['leadId', 'selectedPlans', 'customerId'],
              timeout: 15000,
              onSuccess: { nextStage: 'quotation-created' },
            },
          },
        ],
      },
      metadata: {
        estimatedDuration: 0,
        requiresUserInput: true,
        canSkip: false,
        exitConditions: ['quotation.created'],
      },
    } as EnhancedStageStep,

    // Stage 4: Quotation Created - ASYNC send email
    {
      id: stepIds.quotationCreated,
      order: 4,
      type: 'stage',
      enabled: true,
      stageId: 'quotation-created',
      stageName: 'Quotation Created',
      actionConfig: {
        primaryAction: {
          type: 'async',
          asyncAction: {
            targetService: 'quotation-service',
            actionEvent: 'pipeline.action.send_quotation',
            requiredData: ['leadId', 'quotationId', 'customerEmail'],
            completionEvent: 'service.send_quotation.completed',
            timeout: 60000,
            retryPolicy: { maxRetries: 3, retryDelayMs: 10000 },
          },
        },
        autoAdvance: { enabled: true, delayMs: 5000 },
      },
      metadata: {
        estimatedDuration: 15000,
        requiresUserInput: false,
        canSkip: false,
        exitConditions: ['service.send_quotation.completed'],
      },
    } as EnhancedStageStep,

    // Stage 5: Waiting for Customer Response - Combined stage + wait
    {
      id: stepIds.quotationSent,
      order: 5,
      type: 'stage',
      enabled: true,
      stageId: 'quotation-sent',
      stageName: 'Waiting for Customer Response',
      actionConfig: {
        primaryAction: { type: 'manual' },
      },
      metadata: {
        estimatedDuration: 259200000, // 72 hours
        requiresUserInput: true,
        canSkip: false,
        exitConditions: ['customer.responded', 'quotation.approved', 'quotation.revision_requested'],
      },
    } as EnhancedStageStep,

    // Stage 6: Pending Review (customer selected plan) - Manual approve/reject actions
    {
      id: stepIds.pendingReview,
      order: 6,
      type: 'stage',
      enabled: true,
      stageId: 'pending-review',
      stageName: 'Pending Review',
      actionConfig: {
        primaryAction: { type: 'manual' },
        allowedUserActions: [
          {
            actionId: 'approve_quotation',
            actionName: 'Approve Quotation',
            actionType: 'sync',
            requiresApproval: false,
            requiresPermission: 'quotation.approve',
            syncAction: {
              targetService: 'lead-service',
              endpoint: '/api/leads/{leadId}/approve',
              method: 'POST',
              requiredData: ['leadId', 'quotationId', 'approvedBy'],
              timeout: 10000,
              onSuccess: { nextStage: 'approved' },
            },
            nextStepOverride: stepIds.approved,
          },
          {
            actionId: 'reject_quotation',
            actionName: 'Reject Quotation',
            actionType: 'sync',
            requiresApproval: false,
            requiresPermission: 'quotation.reject',
            syncAction: {
              targetService: 'lead-service',
              endpoint: '/api/leads/{leadId}/reject',
              method: 'POST',
              requiredData: ['leadId', 'quotationId', 'rejectedBy', 'rejectionReason'],
              timeout: 10000,
              onSuccess: { nextStage: 'rejected' },
            },
            nextStepOverride: stepIds.rejected,
          },
          {
            actionId: 'request_revision',
            actionName: 'Request Revision',
            actionType: 'sync',
            requiresApproval: false,
            requiresPermission: 'quotation.revise',
            syncAction: {
              targetService: 'lead-service',
              endpoint: '/api/leads/{leadId}/request-revision',
              method: 'POST',
              requiredData: ['leadId', 'quotationId', 'revisionNotes'],
              timeout: 10000,
              onSuccess: { nextStage: 'revision-requested' },
            },
            nextStepOverride: stepIds.revisionRequested,
          },
        ],
      },
      metadata: {
        estimatedDuration: 0,
        requiresUserInput: true,
        canSkip: false,
        exitConditions: ['quotation.approved', 'quotation.rejected', 'quotation.revision_requested'],
      },
    } as EnhancedStageStep,

    // Stage 7: Approved - ASYNC policy issuance
    {
      id: stepIds.approved,
      order: 7,
      type: 'stage',
      enabled: true,
      stageId: 'approved',
      stageName: 'Approved',
      actionConfig: {
        primaryAction: {
          type: 'async',
          asyncAction: {
            targetService: 'policy-service',
            actionEvent: 'pipeline.action.issue_policy',
            requiredData: ['leadId', 'quotationId', 'customerId', 'selectedPlanId'],
            completionEvent: 'service.issue_policy.completed',
            timeout: 180000, // 3 minutes
            retryPolicy: { maxRetries: 1, retryDelayMs: 30000 },
          },
        },
        autoAdvance: { enabled: true, delayMs: 2000 },
      },
      metadata: {
        estimatedDuration: 120000,
        requiresUserInput: false,
        canSkip: false,
        exitConditions: ['service.issue_policy.completed'],
      },
    } as EnhancedStageStep,

    // Stage 8: Policy Requested (transitional state)
    {
      id: stepIds.policyRequested,
      order: 8,
      type: 'stage',
      enabled: true,
      stageId: 'policy-requested',
      stageName: 'Policy Requested',
      metadata: {
        estimatedDuration: 0,
        requiresUserInput: false,
        canSkip: false,
        exitConditions: [],
      },
    } as StageStep,

    // Stage 9: Policy Issued (final success state)
    {
      id: stepIds.policyIssued,
      order: 9,
      type: 'stage',
      enabled: true,
      stageId: 'policy-issued',
      stageName: 'Policy Issued',
      metadata: {
        estimatedDuration: 0,
        requiresUserInput: false,
        canSkip: false,
        exitConditions: [],
      },
    } as StageStep,

    // Stage 10: Revision Requested (customer wants changes)
    {
      id: stepIds.revisionRequested,
      order: 10,
      type: 'stage',
      enabled: true,
      stageId: 'revision-requested',
      stageName: 'Revision Requested',
      metadata: {
        estimatedDuration: 0,
        requiresUserInput: true,
        canSkip: false,
        exitConditions: [],
      },
    } as StageStep,

    // Stage 11: Rejected (manual rejection)
    {
      id: stepIds.rejected,
      order: 11,
      type: 'stage',
      enabled: true,
      stageId: 'rejected',
      stageName: 'Rejected',
      metadata: {
        estimatedDuration: 0,
        requiresUserInput: false,
        canSkip: false,
        exitConditions: [],
      },
    } as StageStep,

    // Stage 12: Lost (customer declined)
    {
      id: stepIds.lost,
      order: 12,
      type: 'stage',
      enabled: true,
      stageId: 'lost',
      stageName: 'Lost',
      metadata: {
        estimatedDuration: 0,
        requiresUserInput: false,
        canSkip: false,
        exitConditions: [],
      },
    } as StageStep,

    // Stage 13: Cancelled
    {
      id: stepIds.cancelled,
      order: 13,
      type: 'stage',
      enabled: true,
      stageId: 'cancelled',
      stageName: 'Cancelled',
      metadata: {
        estimatedDuration: 0,
        requiresUserInput: false,
        canSkip: false,
        exitConditions: [],
      },
    } as StageStep,
  ];

  return {
    id: uuidv4(),
    pipelineId: uuidv4(),
    name: 'Medical Insurance Pipeline v2 (Enhanced)',
    description: 'Configuration-driven hybrid sync/async pipeline with action configs',
    version: 2,
    lineOfBusiness: 'medical',
    businessType: 'individual',
    status: 'active',
    isDefault: true,
    steps,
    entryStepId: stepIds.leadCreated,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
  };
}
