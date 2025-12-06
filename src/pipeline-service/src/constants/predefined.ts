/**
 * Predefined Constants for Pipeline Service
 * All available options for pipeline steps
 */

import type {
  PredefinedStageId,
  PredefinedApproverRole,
  PredefinedConditionType,
  PredefinedNotificationType,
  PredefinedWaitEvent,
  LineOfBusiness,
} from '../models/pipeline';

// =============================================================================
// Predefined Stages
// =============================================================================

export interface StageDefinition {
  id: PredefinedStageId;
  name: string;
  description: string;
  icon: string;
  triggerEvent?: string;
  progressPercent: number;
  applicableFor: LineOfBusiness[];
  order: number;
}

export const PREDEFINED_STAGES: StageDefinition[] = [
  {
    id: 'lead-created',
    name: 'Lead Created',
    description: 'Initial lead creation',
    icon: 'user-plus',
    triggerEvent: 'lead.created',
    progressPercent: 5,
    applicableFor: ['medical', 'motor', 'general', 'marine'],
    order: 1,
  },
  {
    id: 'plans-fetching',
    name: 'Plans Fetching',
    description: 'Fetching insurance plans from vendors',
    icon: 'loader',
    triggerEvent: 'plans.fetch_started',
    progressPercent: 10,
    applicableFor: ['medical', 'motor', 'general', 'marine'],
    order: 2,
  },
  {
    id: 'plans-available',
    name: 'Plans Available',
    description: 'Insurance plans have been fetched and are ready for review',
    icon: 'list',
    triggerEvent: 'plans.fetch_completed',
    progressPercent: 25,
    applicableFor: ['medical', 'motor', 'general', 'marine'],
    order: 3,
  },
  {
    id: 'quotation-created',
    name: 'Quotation Created',
    description: 'Quotation has been created for the lead',
    icon: 'file-text',
    triggerEvent: 'quotation.created',
    progressPercent: 40,
    applicableFor: ['medical', 'motor', 'general', 'marine'],
    order: 4,
  },
  {
    id: 'quotation-sent',
    name: 'Quotation Sent',
    description: 'Quotation has been sent to the customer',
    icon: 'mail',
    triggerEvent: 'quotation.sent',
    progressPercent: 55,
    applicableFor: ['medical', 'motor', 'general', 'marine'],
    order: 5,
  },
  {
    id: 'pending-review',
    name: 'Pending Review',
    description: 'Awaiting review or customer response',
    icon: 'clock',
    triggerEvent: 'quotation.pending_approval',
    progressPercent: 65,
    applicableFor: ['medical', 'motor', 'general', 'marine'],
    order: 6,
  },
  {
    id: 'approved',
    name: 'Approved',
    description: 'Quotation has been approved',
    icon: 'check-circle',
    triggerEvent: 'quotation.approved',
    progressPercent: 80,
    applicableFor: ['medical', 'motor', 'general', 'marine'],
    order: 7,
  },
  {
    id: 'rejected',
    name: 'Rejected',
    description: 'Quotation has been rejected',
    icon: 'x-circle',
    triggerEvent: 'quotation.rejected',
    progressPercent: 100,
    applicableFor: ['medical', 'motor', 'general', 'marine'],
    order: 8,
  },
  {
    id: 'policy-requested',
    name: 'Policy Requested',
    description: 'Policy request has been submitted',
    icon: 'file-plus',
    triggerEvent: 'policy.requested',
    progressPercent: 85,
    applicableFor: ['medical', 'motor', 'general', 'marine'],
    order: 9,
  },
  {
    id: 'policy-issued',
    name: 'Policy Issued',
    description: 'Policy has been issued successfully',
    icon: 'award',
    triggerEvent: 'policy.issued',
    progressPercent: 100,
    applicableFor: ['medical', 'motor', 'general', 'marine'],
    order: 10,
  },
  {
    id: 'lost',
    name: 'Lost',
    description: 'Lead has been lost',
    icon: 'user-x',
    triggerEvent: 'lead.lost',
    progressPercent: 100,
    applicableFor: ['medical', 'motor', 'general', 'marine'],
    order: 98,
  },
  {
    id: 'cancelled',
    name: 'Cancelled',
    description: 'Lead has been cancelled',
    icon: 'ban',
    triggerEvent: 'lead.cancelled',
    progressPercent: 100,
    applicableFor: ['medical', 'motor', 'general', 'marine'],
    order: 99,
  },
];

// =============================================================================
// Predefined Approver Roles
// =============================================================================

export interface ApproverRoleDefinition {
  id: PredefinedApproverRole;
  name: string;
  description: string;
  icon: string;
  defaultTimeoutHours: number;
}

export const PREDEFINED_APPROVERS: ApproverRoleDefinition[] = [
  {
    id: 'manager',
    name: 'Manager',
    description: 'Direct manager approval',
    icon: 'user-check',
    defaultTimeoutHours: 24,
  },
  {
    id: 'senior-manager',
    name: 'Senior Manager',
    description: 'Senior manager approval for high-value cases',
    icon: 'users',
    defaultTimeoutHours: 48,
  },
  {
    id: 'underwriter',
    name: 'Underwriter',
    description: 'Underwriting team approval',
    icon: 'shield-check',
    defaultTimeoutHours: 72,
  },
  {
    id: 'compliance',
    name: 'Compliance Officer',
    description: 'Compliance review and approval',
    icon: 'file-check',
    defaultTimeoutHours: 48,
  },
  {
    id: 'finance',
    name: 'Finance',
    description: 'Finance team approval',
    icon: 'wallet',
    defaultTimeoutHours: 24,
  },
];

// =============================================================================
// Predefined Conditions
// =============================================================================

export interface ConditionDefinition {
  id: PredefinedConditionType;
  name: string;
  description: string;
  icon: string;
  hasValue: boolean;
  valueType?: 'number' | 'string';
  valueLabel?: string;
  valuePlaceholder?: string;
}

export const PREDEFINED_CONDITIONS: ConditionDefinition[] = [
  {
    id: 'is_hot_lead',
    name: 'Is Hot Lead?',
    description: 'Check if the lead is marked as hot',
    icon: 'flame',
    hasValue: false,
  },
  {
    id: 'lob_is_medical',
    name: 'LOB is Medical?',
    description: 'Check if line of business is medical/health insurance',
    icon: 'heart-pulse',
    hasValue: false,
  },
  {
    id: 'lob_is_motor',
    name: 'LOB is Motor?',
    description: 'Check if line of business is motor insurance',
    icon: 'car',
    hasValue: false,
  },
  {
    id: 'lob_is_general',
    name: 'LOB is General?',
    description: 'Check if line of business is general insurance',
    icon: 'shield',
    hasValue: false,
  },
  {
    id: 'lob_is_marine',
    name: 'LOB is Marine?',
    description: 'Check if line of business is marine insurance',
    icon: 'anchor',
    hasValue: false,
  },
  {
    id: 'business_type_is_individual',
    name: 'Business Type is Individual?',
    description: 'Check if business type is individual',
    icon: 'user',
    hasValue: false,
  },
  {
    id: 'business_type_is_group',
    name: 'Business Type is Group?',
    description: 'Check if business type is group/corporate',
    icon: 'users',
    hasValue: false,
  },
  {
    id: 'lead_value_above_threshold',
    name: 'Lead Value > Threshold',
    description: 'Check if lead value exceeds a specified amount',
    icon: 'trending-up',
    hasValue: true,
    valueType: 'number',
    valueLabel: 'Threshold Value (AED)',
    valuePlaceholder: '50000',
  },
  {
    id: 'has_required_documents',
    name: 'Has Required Documents?',
    description: 'Check if all required documents have been uploaded',
    icon: 'file-check',
    hasValue: false,
  },
  {
    id: 'quotation_approved',
    name: 'Quotation Approved?',
    description: 'Check if the quotation was approved by customer',
    icon: 'check-circle',
    hasValue: false,
  },
  {
    id: 'quotation_rejected',
    name: 'Quotation Rejected?',
    description: 'Check if the quotation was rejected',
    icon: 'x-circle',
    hasValue: false,
  },
  {
    id: 'customer_responded',
    name: 'Customer Responded?',
    description: 'Check if the customer has responded',
    icon: 'message-circle',
    hasValue: false,
  },
];

// =============================================================================
// Predefined Notification Types
// =============================================================================

export interface NotificationDefinition {
  id: PredefinedNotificationType;
  name: string;
  description: string;
  icon: string;
  channel: 'email' | 'sms' | 'push';
  recipientType: 'customer' | 'agent' | 'manager';
  templateId: string;
}

export const PREDEFINED_NOTIFICATIONS: NotificationDefinition[] = [
  {
    id: 'email_customer_stage_update',
    name: 'Email Customer - Stage Update',
    description: 'Send email to customer about stage change',
    icon: 'mail',
    channel: 'email',
    recipientType: 'customer',
    templateId: 'customer-stage-update',
  },
  {
    id: 'email_customer_quotation',
    name: 'Email Customer - Quotation',
    description: 'Send quotation email to customer',
    icon: 'mail',
    channel: 'email',
    recipientType: 'customer',
    templateId: 'customer-quotation',
  },
  {
    id: 'email_agent_assignment',
    name: 'Email Agent - New Assignment',
    description: 'Notify agent about new lead assignment',
    icon: 'mail',
    channel: 'email',
    recipientType: 'agent',
    templateId: 'agent-lead-assigned',
  },
  {
    id: 'email_agent_action_required',
    name: 'Email Agent - Action Required',
    description: 'Notify agent that action is required on a lead',
    icon: 'mail',
    channel: 'email',
    recipientType: 'agent',
    templateId: 'agent-action-required',
  },
  {
    id: 'sms_customer_stage_update',
    name: 'SMS Customer - Stage Update',
    description: 'Send SMS to customer about stage change',
    icon: 'smartphone',
    channel: 'sms',
    recipientType: 'customer',
    templateId: 'customer-stage-sms',
  },
  {
    id: 'push_manager_alert',
    name: 'Push Notification - Manager Alert',
    description: 'Send push notification to manager',
    icon: 'bell',
    channel: 'push',
    recipientType: 'manager',
    templateId: 'manager-alert-push',
  },
  {
    id: 'email_manager_escalation',
    name: 'Email Manager - Escalation',
    description: 'Send escalation email to manager',
    icon: 'alert-triangle',
    channel: 'email',
    recipientType: 'manager',
    templateId: 'manager-escalation',
  },
];

// =============================================================================
// Predefined Wait Events
// =============================================================================

export interface WaitEventDefinition {
  id: PredefinedWaitEvent;
  name: string;
  description: string;
  icon: string;
  eventType?: string;
  defaultTimeoutHours: number;
}

export const PREDEFINED_WAIT_EVENTS: WaitEventDefinition[] = [
  {
    id: 'customer_response',
    name: 'Customer Response',
    description: 'Wait for customer to respond to quotation',
    icon: 'message-circle',
    eventType: 'customer.responded',
    defaultTimeoutHours: 72,
  },
  {
    id: 'document_uploaded',
    name: 'Document Uploaded',
    description: 'Wait for customer to upload required documents',
    icon: 'upload',
    eventType: 'document.uploaded',
    defaultTimeoutHours: 168, // 7 days
  },
  {
    id: 'payment_received',
    name: 'Payment Received',
    description: 'Wait for payment to be received',
    icon: 'credit-card',
    eventType: 'payment.received',
    defaultTimeoutHours: 48,
  },
  {
    id: 'manual_advance',
    name: 'Manual Advance',
    description: 'Wait for manual advancement by user',
    icon: 'hand',
    eventType: 'pipeline.manual_advance',
    defaultTimeoutHours: 0, // No timeout
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get a stage definition by ID
 */
export function getStageById(stageId: PredefinedStageId): StageDefinition | undefined {
  return PREDEFINED_STAGES.find(s => s.id === stageId);
}

/**
 * Get stage definition by trigger event
 */
export function getStageByTriggerEvent(eventType: string): StageDefinition | undefined {
  return PREDEFINED_STAGES.find(s => s.triggerEvent === eventType);
}

/**
 * Get an approver role definition by ID
 */
export function getApproverById(approverId: PredefinedApproverRole): ApproverRoleDefinition | undefined {
  return PREDEFINED_APPROVERS.find(a => a.id === approverId);
}

/**
 * Get a condition definition by ID
 */
export function getConditionById(conditionId: PredefinedConditionType): ConditionDefinition | undefined {
  return PREDEFINED_CONDITIONS.find(c => c.id === conditionId);
}

/**
 * Get a notification definition by ID
 */
export function getNotificationById(notificationId: PredefinedNotificationType): NotificationDefinition | undefined {
  return PREDEFINED_NOTIFICATIONS.find(n => n.id === notificationId);
}

/**
 * Get a wait event definition by ID
 */
export function getWaitEventById(waitEventId: PredefinedWaitEvent): WaitEventDefinition | undefined {
  return PREDEFINED_WAIT_EVENTS.find(w => w.id === waitEventId);
}

/**
 * Get stages applicable for a specific LOB
 */
export function getStagesForLOB(lineOfBusiness: LineOfBusiness): StageDefinition[] {
  return PREDEFINED_STAGES.filter(s => s.applicableFor.includes(lineOfBusiness));
}

/**
 * Map of trigger events to their corresponding stage IDs
 */
export const EVENT_TO_STAGE_MAP: Record<string, PredefinedStageId> = {
  'lead.created': 'lead-created',
  'plans.fetch_started': 'plans-fetching',
  'plans.fetch_completed': 'plans-available',
  'quotation.created': 'quotation-created',
  'quotation.sent': 'quotation-sent',
  'quotation.pending_approval': 'pending-review',
  'quotation.approved': 'approved',
  'quotation.rejected': 'rejected',
  'policy.requested': 'policy-requested',
  'policy.issued': 'policy-issued',
  'lead.lost': 'lost',
  'lead.cancelled': 'cancelled',
};

/**
 * All events that the pipeline orchestrator should listen to
 */
export const PIPELINE_EVENTS = [
  'lead.created',
  'plans.fetch_started',
  'plans.fetch_completed',
  'quotation.created',
  'quotation.sent',
  'quotation.pending_approval',
  'quotation.approved',
  'quotation.rejected',
  'policy.requested',
  'policy.issued',
  'lead.lost',
  'lead.cancelled',
  'customer.responded',
  'document.uploaded',
  'payment.received',
  'pipeline.manual_advance',
  'pipeline.approval.decided',
];

