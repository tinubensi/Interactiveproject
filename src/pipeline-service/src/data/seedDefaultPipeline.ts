/**
 * Default Pipeline Seeder
 * Creates the default Individual Health Insurance pipeline
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  PipelineDefinition,
  StageStep,
  ApprovalStep,
  DecisionStep,
  NotificationStep,
  WaitStep,
} from '../models/pipeline';

/**
 * Generate the default Individual Health Insurance pipeline
 */
export function generateDefaultHealthInsurancePipeline(
  createdBy: string = 'system'
): PipelineDefinition {
  const now = new Date().toISOString();
  const pipelineId = uuidv4();

  // Step IDs (pre-generated for decision branching)
  const stepIds = {
    leadCreated: uuidv4(),
    plansFetching: uuidv4(),
    plansAvailable: uuidv4(),
    hotLeadDecision: uuidv4(),
    hotLeadNotification: uuidv4(),
    quotationCreated: uuidv4(),
    quotationSent: uuidv4(),
    waitCustomerResponse: uuidv4(),
    customerResponseDecision: uuidv4(),
    revisionRequested: uuidv4(),
    pendingReview: uuidv4(),
    underwriterApproval: uuidv4(),
    approved: uuidv4(),
    policyRequested: uuidv4(),
    policyIssued: uuidv4(),
    lost: uuidv4(),
    rejected: uuidv4(),
  };

  // Define all steps
  const steps = [
    // Step 1: Lead Created
    {
      id: stepIds.leadCreated,
      order: 1,
      enabled: true,
      type: 'stage' as const,
      stageId: 'lead-created' as const,
      stageName: 'Lead Created',
      name: 'Lead Created',
      description: 'Initial lead creation - pipeline starts here',
    } satisfies StageStep,

    // Step 2: Plans Fetching
    {
      id: stepIds.plansFetching,
      order: 2,
      enabled: true,
      type: 'stage' as const,
      stageId: 'plans-fetching' as const,
      stageName: 'Plans Fetching',
      name: 'Plans Fetching',
      description: 'Fetching insurance plans from vendors',
    } satisfies StageStep,

    // Step 3: Plans Available
    {
      id: stepIds.plansAvailable,
      order: 3,
      enabled: true,
      type: 'stage' as const,
      stageId: 'plans-available' as const,
      stageName: 'Plans Available',
      name: 'Plans Available',
      description: 'Insurance plans have been fetched and are ready',
      allowedActions: ['CREATE_QUOTATION', 'REFETCH_PLANS', 'MANUAL_ADVANCE'],
    } satisfies StageStep,

    // Step 4: Hot Lead Decision
    {
      id: stepIds.hotLeadDecision,
      order: 4,
      enabled: false, // DISABLED: Prevents auto-advance from Plans Available to Quotation Created
      type: 'decision' as const,
      conditionType: 'is_hot_lead' as const,
      trueNextStepId: stepIds.hotLeadNotification,
      falseNextStepId: stepIds.quotationCreated,
      name: 'Is Hot Lead?',
      description: 'Check if this is a hot lead requiring priority handling',
    } satisfies DecisionStep,

    // Step 5a: Hot Lead Notification (only for hot leads)
    {
      id: stepIds.hotLeadNotification,
      order: 5,
      enabled: false, // DISABLED: Hot Lead Decision is disabled
      type: 'notification' as const,
      notificationType: 'push_manager_alert' as const,
      name: 'Hot Lead Alert',
      description: 'Send notification to manager about hot lead',
    } satisfies NotificationStep,

    // Step 6: Quotation Created
    {
      id: stepIds.quotationCreated,
      order: 6,
      enabled: true,
      type: 'stage' as const,
      stageId: 'quotation-created' as const,
      stageName: 'Quotation Created',
      name: 'Quotation Created',
      description: 'Quotation has been created for the lead',
      allowedActions: ['SEND_QUOTATION', 'MANUAL_ADVANCE'],
    } satisfies StageStep,

    // Step 7: Quotation Sent
    {
      id: stepIds.quotationSent,
      order: 7,
      enabled: true,
      type: 'stage' as const,
      stageId: 'quotation-sent' as const,
      stageName: 'Quotation Sent',
      name: 'Quotation Sent',
      description: 'Quotation has been sent to the customer',
      allowedActions: ['MANUAL_ADVANCE'],
    } satisfies StageStep,

    // Step 8: Wait for Customer Response
    {
      id: stepIds.waitCustomerResponse,
      order: 8,
      enabled: true,
      type: 'wait' as const,
      waitForEvent: 'customer_response' as const,
      timeoutHours: 72,
      name: 'Wait for Customer Response',
      description: 'Wait for customer to respond to the quotation',
    } satisfies WaitStep,

    // Step 9: Customer Response Decision
    {
      id: stepIds.customerResponseDecision,
      order: 9,
      enabled: true,
      type: 'decision' as const,
      conditionType: 'quotation_approved' as const,
      trueNextStepId: stepIds.pendingReview,
      falseNextStepId: stepIds.lost,
      name: 'Quotation Approved?',
      description: 'Check if customer approved the quotation',
    } satisfies DecisionStep,

    // Step 9.5: Revision Requested (Customer requested changes)
    {
      id: stepIds.revisionRequested,
      order: 9.5,
      enabled: true,
      type: 'stage' as const,
      stageId: 'revision-requested' as const,
      stageName: 'Revision Requested',
      name: 'Revision Requested',
      description: 'Customer has requested changes to the quotation',
      allowedActions: ['CREATE_QUOTATION', 'REFETCH_PLANS', 'MANUAL_ADVANCE'],
    } satisfies StageStep,

    // Step 10: Pending Review (Customer selected plan - awaiting internal review)
    {
      id: stepIds.pendingReview,
      order: 10,
      enabled: true,
      type: 'stage' as const,
      stageId: 'pending-review' as const,
      stageName: 'Pending Review',
      name: 'Pending Review',
      description: 'Customer has selected a plan - awaiting internal review and approval',
      allowedActions: ['APPROVE_QUOTATION', 'REJECT_QUOTATION', 'MANUAL_ADVANCE'],
    } satisfies StageStep,

    // Step 11: Underwriter Approval (optional - can be disabled)
    {
      id: stepIds.underwriterApproval,
      order: 11,
      enabled: false, // Disabled by default - can be enabled for high-value cases
      type: 'approval' as const,
      approverRole: 'underwriter' as const,
      timeoutHours: 48,
      escalationRole: 'senior-manager' as const,
      name: 'Underwriter Approval',
      description: 'Requires underwriter approval (enable for high-value policies)',
    } satisfies ApprovalStep,

    // Step 12: Approved
    {
      id: stepIds.approved,
      order: 12,
      enabled: true,
      type: 'stage' as const,
      stageId: 'approved' as const,
      stageName: 'Approved',
      name: 'Approved',
      description: 'Quotation has been approved',
    } satisfies StageStep,

    // Step 13: Policy Requested
    {
      id: stepIds.policyRequested,
      order: 13,
      enabled: true,
      type: 'stage' as const,
      stageId: 'policy-requested' as const,
      stageName: 'Policy Requested',
      name: 'Policy Requested',
      description: 'Policy request has been submitted',
    } satisfies StageStep,

    // Step 14: Policy Issued (End - Success)
    {
      id: stepIds.policyIssued,
      order: 14,
      enabled: true,
      type: 'stage' as const,
      stageId: 'policy-issued' as const,
      stageName: 'Policy Issued',
      name: 'Policy Issued',
      description: 'Policy has been issued successfully - Pipeline Complete',
    } satisfies StageStep,

    // Step 15: Lost (End - Failure Branch)
    {
      id: stepIds.lost,
      order: 98,
      enabled: true,
      type: 'stage' as const,
      stageId: 'lost' as const,
      stageName: 'Lost',
      name: 'Lost',
      description: 'Lead has been lost - Pipeline Complete',
    } satisfies StageStep,

    // Step 16: Rejected (End - Rejection Branch)
    {
      id: stepIds.rejected,
      order: 99,
      enabled: true,
      type: 'stage' as const,
      stageId: 'rejected' as const,
      stageName: 'Rejected',
      name: 'Rejected',
      description: 'Quotation was rejected - Pipeline Complete',
    } satisfies StageStep,
  ];

  const pipeline: PipelineDefinition = {
    id: pipelineId,
    pipelineId,
    name: 'Individual Health Insurance Pipeline',
    description: 'Default pipeline for individual health/medical insurance leads. Includes hot lead detection, customer response tracking, and optional underwriter approval for high-value cases.',
    version: 1,
    lineOfBusiness: 'medical',
    businessType: 'individual',
    status: 'draft', // Will be activated during seeding
    isDefault: true,
    steps,
    entryStepId: stepIds.leadCreated,
    createdAt: now,
    createdBy,
  };

  return pipeline;
}

/**
 * Seed data structure for database
 */
export interface SeedResult {
  pipeline: PipelineDefinition;
  message: string;
}

/**
 * Get the seed data ready for insertion
 */
export function getSeedData(createdBy: string = 'system'): SeedResult {
  const pipeline = generateDefaultHealthInsurancePipeline(createdBy);

  return {
    pipeline,
    message: `Generated default Individual Health Insurance pipeline with ${pipeline.steps.length} steps`,
  };
}

