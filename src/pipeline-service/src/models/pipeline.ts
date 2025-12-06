/**
 * Pipeline Service - Core Type Definitions
 */

// =============================================================================
// Enums and Literal Types
// =============================================================================

export type LineOfBusiness = 'medical' | 'motor' | 'general' | 'marine';
export type BusinessType = 'individual' | 'group';

export type PipelineStatus = 'draft' | 'active' | 'inactive' | 'deprecated';

export type StepType = 'stage' | 'approval' | 'decision' | 'notification' | 'wait';

export type InstanceStatus = 
  | 'active' 
  | 'waiting_approval' 
  | 'waiting_event' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

// =============================================================================
// Predefined Option IDs
// =============================================================================

export type PredefinedStageId =
  | 'lead-created'
  | 'plans-fetching'
  | 'plans-available'
  | 'quotation-created'
  | 'quotation-sent'
  | 'pending-review'
  | 'approved'
  | 'rejected'
  | 'policy-requested'
  | 'policy-issued'
  | 'lost'
  | 'cancelled';

export type PredefinedApproverRole =
  | 'manager'
  | 'senior-manager'
  | 'underwriter'
  | 'compliance'
  | 'finance';

export type PredefinedConditionType =
  | 'is_hot_lead'
  | 'lob_is_medical'
  | 'lob_is_motor'
  | 'lob_is_general'
  | 'lob_is_marine'
  | 'business_type_is_individual'
  | 'business_type_is_group'
  | 'lead_value_above_threshold'
  | 'has_required_documents'
  | 'quotation_approved'
  | 'quotation_rejected'
  | 'customer_responded';

export type PredefinedNotificationType =
  | 'email_customer_stage_update'
  | 'email_customer_quotation'
  | 'email_agent_assignment'
  | 'email_agent_action_required'
  | 'sms_customer_stage_update'
  | 'push_manager_alert'
  | 'email_manager_escalation';

export type PredefinedWaitEvent =
  | 'customer_response'
  | 'document_uploaded'
  | 'payment_received'
  | 'manual_advance';

// =============================================================================
// Pipeline Step Definitions
// =============================================================================

/**
 * Base step properties shared by all step types
 */
export interface BaseStep {
  id: string;
  order: number;
  enabled: boolean;
  name?: string;
  description?: string;
}

/**
 * Stage step - moves lead to a specific stage
 */
export interface StageStep extends BaseStep {
  type: 'stage';
  stageId: PredefinedStageId;
  stageName: string;
  triggerEvent?: string; // Event that triggers this stage
}

/**
 * Approval step - requires approval from a specific role
 */
export interface ApprovalStep extends BaseStep {
  type: 'approval';
  approverRole: PredefinedApproverRole;
  timeoutHours?: number;
  escalationRole?: PredefinedApproverRole;
}

/**
 * Decision step - branches based on a condition
 */
export interface DecisionStep extends BaseStep {
  type: 'decision';
  conditionType: PredefinedConditionType;
  conditionValue?: string | number; // For threshold conditions
  trueNextStepId: string;
  falseNextStepId: string;
}

/**
 * Notification step - sends a notification
 */
export interface NotificationStep extends BaseStep {
  type: 'notification';
  notificationType: PredefinedNotificationType;
  customMessage?: string;
}

/**
 * Wait step - waits for an event or timeout
 */
export interface WaitStep extends BaseStep {
  type: 'wait';
  waitForEvent: PredefinedWaitEvent;
  timeoutHours?: number;
  onTimeoutStepId?: string; // Step to go to on timeout
}

/**
 * Union type for all step types
 */
export type PipelineStep = StageStep | ApprovalStep | DecisionStep | NotificationStep | WaitStep;

// =============================================================================
// Pipeline Definition
// =============================================================================

/**
 * Pipeline Definition - Configures the flow for leads of a specific LOB
 */
export interface PipelineDefinition {
  // Identity
  id: string;
  pipelineId: string;
  
  // Metadata
  name: string;
  description?: string;
  version: number;
  
  // Scope
  lineOfBusiness: LineOfBusiness;
  businessType?: BusinessType; // Optional - if not set, applies to all
  organizationId?: string;
  
  // Status
  status: PipelineStatus;
  isDefault?: boolean; // If true, used when no other pipeline matches
  
  // Steps
  steps: PipelineStep[];
  
  // Entry point
  entryStepId: string;
  
  // Audit
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
  activatedAt?: string;
  activatedBy?: string;
}

// =============================================================================
// Pipeline Instance (Per-Lead Tracking)
// =============================================================================

/**
 * Step history entry
 */
export interface StepHistoryEntry {
  stepId: string;
  stepType: StepType;
  stageName?: string;
  enteredAt: string;
  exitedAt?: string;
  outcome?: 'completed' | 'approved' | 'rejected' | 'skipped' | 'timeout' | 'branched';
  triggeredBy: string; // Event name, user ID, or 'system'
  metadata?: Record<string, unknown>;
}

/**
 * Pipeline Instance - Tracks a lead's progress through a pipeline
 */
export interface PipelineInstance {
  // Identity
  id: string;
  instanceId: string;
  
  // References
  pipelineId: string;
  pipelineVersion: number;
  pipelineName: string;
  leadId: string;
  lineOfBusiness: LineOfBusiness;
  organizationId?: string;
  
  // Current state
  status: InstanceStatus;
  currentStepId: string;
  currentStepType: StepType;
  currentStageName?: string;
  currentStageId?: string;
  
  // Progress
  progressPercent: number;
  completedStepsCount: number;
  totalStepsCount: number;
  
  // Next step info
  nextStepId?: string;
  nextStepType?: StepType;
  nextStageName?: string;
  
  // Waiting state
  waitingForEvent?: string;
  waitingForApprovalId?: string;
  waitingUntil?: string; // Timeout timestamp
  
  // History
  stepHistory: StepHistoryEntry[];
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  
  // Error tracking
  lastError?: {
    stepId: string;
    message: string;
    timestamp: string;
  };
}

// =============================================================================
// Approval Request
// =============================================================================

/**
 * Approval Request - Created when a lead reaches an approval step
 */
export interface ApprovalRequest {
  // Identity
  id: string;
  approvalId: string;
  
  // References
  instanceId: string;
  pipelineId: string;
  leadId: string;
  stepId: string;
  stepName: string;
  
  // Approval config
  approverRole: PredefinedApproverRole;
  escalationRole?: PredefinedApproverRole;
  
  // Status
  status: ApprovalStatus;
  
  // Decision
  decision?: 'approved' | 'rejected';
  decidedBy?: string;
  decidedByName?: string;
  decidedAt?: string;
  comment?: string;
  
  // Context
  leadReferenceId?: string;
  leadSummary?: Record<string, unknown>;
  
  // Timing
  requestedAt: string;
  expiresAt?: string;
  escalatedAt?: string;
  
  // Audit
  createdAt: string;
  updatedAt?: string;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface CreatePipelineRequest {
  name: string;
  description?: string;
  lineOfBusiness: LineOfBusiness;
  businessType?: BusinessType;
  organizationId?: string;
  steps?: PipelineStep[];
  isDefault?: boolean;
}

export interface UpdatePipelineRequest {
  name?: string;
  description?: string;
  steps?: PipelineStep[];
  isDefault?: boolean;
}

export interface AddStepRequest {
  step: Omit<PipelineStep, 'id'>;
  afterStepId?: string;
}

export interface UpdateStepRequest {
  enabled?: boolean;
  name?: string;
  description?: string;
  // Type-specific updates
  stageId?: PredefinedStageId;
  approverRole?: PredefinedApproverRole;
  conditionType?: PredefinedConditionType;
  conditionValue?: string | number;
  trueNextStepId?: string;
  falseNextStepId?: string;
  notificationType?: PredefinedNotificationType;
  waitForEvent?: PredefinedWaitEvent;
  timeoutHours?: number;
}

export interface ReorderStepsRequest {
  stepOrder: Array<{ stepId: string; order: number }>;
}

export interface ApprovalDecisionRequest {
  decision: 'approved' | 'rejected';
  comment?: string;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface PipelineListResponse {
  pipelines: PipelineDefinition[];
  count: number;
}

export interface InstanceListResponse {
  instances: PipelineInstance[];
  count: number;
}

export interface ApprovalListResponse {
  approvals: ApprovalRequest[];
  count: number;
}

export interface NextStepInfo {
  leadId: string;
  hasActivePipeline: boolean;
  instanceId?: string;
  currentStepId?: string;
  currentStepType?: StepType;
  currentStageName?: string;
  currentStageId?: string;
  nextStepId?: string;
  nextStepType?: StepType;
  nextStageName?: string;
  nextStageId?: string;
  progressPercent?: number;
  status?: InstanceStatus;
  waitingFor?: string;
}

