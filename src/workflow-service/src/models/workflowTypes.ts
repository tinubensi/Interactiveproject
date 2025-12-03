// ============================================================================
// Workflow Management Service - Core Type Definitions
// ============================================================================

// ----------------------------------------------------------------------------
// Enums and Literal Types
// ----------------------------------------------------------------------------

export type WorkflowStatus = 'draft' | 'active' | 'inactive' | 'deprecated';

export type StepType =
  | 'action'
  | 'decision'
  | 'parallel'
  | 'wait'
  | 'loop'
  | 'human'
  | 'subworkflow'
  | 'transform'
  | 'script'
  | 'setVariable'
  | 'delay'
  | 'retry'
  | 'compensate'
  | 'terminate';

export type ActionType =
  | 'http_request'
  | 'publish_event'
  | 'send_command'
  | 'cosmos_query'
  | 'cosmos_upsert'
  | 'cosmos_delete'
  | 'send_notification'
  | 'call_function';

export type TriggerType = 'event' | 'http' | 'schedule' | 'manual';

export type InstanceStatus =
  | 'pending'
  | 'running'
  | 'waiting'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out';

export type StepExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'waiting';

export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'in'
  | 'notIn'
  | 'exists'
  | 'notExists'
  | 'regex'
  | 'and'
  | 'or'
  | 'not';

export type ErrorAction = 'retry' | 'skip' | 'fail' | 'goto' | 'compensate';

export type BackoffType = 'fixed' | 'exponential';

export type JoinCondition = 'all' | 'any' | 'n-of-m';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'reassigned' | 'expired';

// ----------------------------------------------------------------------------
// Audit Metadata
// ----------------------------------------------------------------------------

export interface AuditMetadata {
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

// ----------------------------------------------------------------------------
// Trigger Configurations
// ----------------------------------------------------------------------------

export interface EventTriggerConfig {
  eventType: string;
  eventFilter?: string;
  extractVariables?: Record<string, string>;
}

export interface HttpTriggerConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  route?: string;
  validatePayload?: Record<string, unknown>;
}

export interface ScheduleTriggerConfig {
  cronExpression: string;
  timezone?: string;
}

export interface ManualTriggerConfig {
  requiredInputs?: Record<string, VariableDefinition>;
}

export type TriggerConfig =
  | EventTriggerConfig
  | HttpTriggerConfig
  | ScheduleTriggerConfig
  | ManualTriggerConfig;

export interface TriggerDefinition {
  id: string;
  type: TriggerType;
  config: TriggerConfig;
  isActive?: boolean;
}

// ----------------------------------------------------------------------------
// Condition Expressions
// ----------------------------------------------------------------------------

export interface SimpleCondition {
  left: string;
  operator: Exclude<ConditionOperator, 'and' | 'or' | 'not'>;
  right: string | number | boolean | null | unknown[];
}

export interface CompoundCondition {
  operator: 'and' | 'or';
  conditions: ConditionExpression[];
}

export interface NotCondition {
  operator: 'not';
  condition: ConditionExpression;
}

export type ConditionExpression = SimpleCondition | CompoundCondition | NotCondition;

export interface TransitionRule {
  targetStepId: string;
  condition?: ConditionExpression;
  isDefault?: boolean;
  priority?: number;
}

// ----------------------------------------------------------------------------
// Retry Policy
// ----------------------------------------------------------------------------

export interface RetryPolicy {
  maxAttempts: number;
  backoffType: BackoffType;
  initialDelaySeconds: number;
  maxDelaySeconds?: number;
  retryableErrors?: string[];
}

// ----------------------------------------------------------------------------
// Error Handling
// ----------------------------------------------------------------------------

export interface ErrorHandler {
  action: ErrorAction;
  retryPolicy?: RetryPolicy;
  fallbackStepId?: string;
  compensationStepId?: string;
}

// ----------------------------------------------------------------------------
// Action Configurations
// ----------------------------------------------------------------------------

export interface HttpRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  validateStatus?: number[];
  auth?: {
    type: 'bearer' | 'basic' | 'api-key';
    token?: string;
    username?: string;
    password?: string;
    headerName?: string;
    apiKey?: string;
  };
}

export interface PublishEventConfig {
  eventType: string;
  subject?: string;
  data: Record<string, unknown>;
  dataVersion?: string;
}

export interface SendCommandConfig {
  queueName: string;
  command: Record<string, unknown>;
  sessionId?: string;
  correlationId?: string;
}

export interface CosmosQueryConfig {
  container: string;
  query: string;
  parameters?: Record<string, unknown>;
  partitionKey?: string;
}

export interface CosmosUpsertConfig {
  container: string;
  document: Record<string, unknown>;
  partitionKey?: string;
}

export interface CosmosDeleteConfig {
  container: string;
  documentId: string;
  partitionKey: string;
}

export interface SendNotificationConfig {
  channel: 'email' | 'sms' | 'push' | 'webhook';
  template?: string;
  to: string | string[];
  subject?: string;
  body?: string;
  data?: Record<string, unknown>;
}

export interface CallFunctionConfig {
  functionName: string;
  input?: Record<string, unknown>;
}

export type ActionConfig =
  | HttpRequestConfig
  | PublishEventConfig
  | SendCommandConfig
  | CosmosQueryConfig
  | CosmosUpsertConfig
  | CosmosDeleteConfig
  | SendNotificationConfig
  | CallFunctionConfig;

// ----------------------------------------------------------------------------
// Step Action
// ----------------------------------------------------------------------------

export interface StepAction {
  type: ActionType;
  config: ActionConfig;
  outputVariable?: string;
}

// ----------------------------------------------------------------------------
// Wait Configuration
// ----------------------------------------------------------------------------

export interface WaitForEvent {
  type: 'event';
  eventType: string;
  eventFilter?: string;
  extractVariables?: Record<string, string>;
}

export interface WaitForTimeout {
  type: 'timeout';
  durationSeconds: number;
}

export interface WaitForApproval {
  type: 'approval';
  approverRoles?: string[];
  approverUsers?: string[];
  requiredApprovals?: number;
  escalationAfterSeconds?: number;
  escalateTo?: string[];
}

export type WaitConfig = WaitForEvent | WaitForTimeout | WaitForApproval;

// ----------------------------------------------------------------------------
// Parallel Branch
// ----------------------------------------------------------------------------

export interface ParallelBranch {
  id: string;
  name?: string;
  steps: WorkflowStep[];
}

export interface ParallelConfig {
  branches: ParallelBranch[];
  joinCondition: JoinCondition;
  joinCount?: number;
  timeout?: number;
  continueOnBranchFailure?: boolean;
}

// ----------------------------------------------------------------------------
// Loop Configuration
// ----------------------------------------------------------------------------

export interface LoopConfig {
  collection: string;
  itemVariable: string;
  indexVariable?: string;
  maxIterations?: number;
  parallelism?: number;
  steps: WorkflowStep[];
  breakCondition?: ConditionExpression;
}

// ----------------------------------------------------------------------------
// Script Configuration
// ----------------------------------------------------------------------------

export interface ScriptConfig {
  code: string;
  timeout?: number;
  allowedGlobals?: string[];
}

// ----------------------------------------------------------------------------
// Transform Configuration
// ----------------------------------------------------------------------------

export interface TransformConfig {
  expression: string;
  outputVariable: string;
}

// ----------------------------------------------------------------------------
// Subworkflow Configuration
// ----------------------------------------------------------------------------

export interface SubworkflowConfig {
  workflowId: string;
  version?: number;
  inputMapping?: Record<string, string>;
  outputMapping?: Record<string, string>;
  waitForCompletion?: boolean;
}

// ----------------------------------------------------------------------------
// Human Step Configuration
// ----------------------------------------------------------------------------

export interface HumanConfig {
  approverRoles?: string[];
  approverUsers?: string[];
  requiredApprovals?: number;
  expiresInSeconds?: number;
  escalationAfterSeconds?: number;
  escalateTo?: string[];
  context?: {
    displayFields?: string[];
    instructions?: string;
    formSchema?: Record<string, unknown>;
  };
}

// ----------------------------------------------------------------------------
// Compensation Configuration
// ----------------------------------------------------------------------------

export interface CompensationStep {
  type: 'action';
  action: StepAction;
}

// ----------------------------------------------------------------------------
// Workflow Step
// ----------------------------------------------------------------------------

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  order: number;
  description?: string;
  isEnabled?: boolean;

  // Type-specific configurations
  action?: StepAction;
  conditions?: TransitionRule[];
  parallelConfig?: ParallelConfig;
  waitConfig?: WaitConfig;
  loopConfig?: LoopConfig;
  scriptConfig?: ScriptConfig;
  transformConfig?: TransformConfig;
  subworkflowConfig?: SubworkflowConfig;
  humanConfig?: HumanConfig;

  // Variable operations
  setVariables?: Record<string, unknown>;
  outputVariable?: string;

  // Delay configuration
  delaySeconds?: number;

  // Transitions
  transitions?: TransitionRule[];

  // Error handling
  onError?: ErrorHandler;
  compensation?: CompensationStep;
  timeout?: number;

  // Metadata
  tags?: string[];
  metadata?: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// Variable Definition
// ----------------------------------------------------------------------------

export interface VariableDefinition {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date';
  defaultValue?: unknown;
  description?: string;
  required?: boolean;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    enum?: unknown[];
  };
}

// ----------------------------------------------------------------------------
// Workflow Settings
// ----------------------------------------------------------------------------

export interface WorkflowSettings {
  maxExecutionDurationSeconds?: number;
  allowParallelExecutions?: boolean;
  maxParallelExecutions?: number;
  executionRetentionDays?: number;
  notifyOnFailure?: string[];
  notifyOnCompletion?: string[];
  enableAuditLogging?: boolean;
  enableMetrics?: boolean;
}

// ----------------------------------------------------------------------------
// Workflow Definition
// ----------------------------------------------------------------------------

export interface WorkflowDefinition extends AuditMetadata {
  id: string;
  workflowId: string;
  name: string;
  description?: string;
  version: number;
  status: WorkflowStatus;
  organizationId: string;

  // Configuration
  triggers: TriggerDefinition[];
  steps: WorkflowStep[];
  variables?: Record<string, VariableDefinition>;

  // Settings
  settings?: WorkflowSettings;

  // Metadata
  tags?: string[];
  category?: string;

  // Activation
  activatedAt?: string;
  activatedBy?: string;

  // Soft delete
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

// ----------------------------------------------------------------------------
// Step Execution
// ----------------------------------------------------------------------------

export interface StepExecution {
  stepId: string;
  stepName: string;
  stepType: StepType;
  status: StepExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: ExecutionError;
  retryCount?: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface ExecutionError {
  code: string;
  message: string;
  details?: unknown;
  stack?: string;
}

// ----------------------------------------------------------------------------
// Workflow Instance
// ----------------------------------------------------------------------------

export interface WorkflowInstance {
  id: string;
  instanceId: string;
  workflowId: string;
  workflowVersion: number;
  workflowName: string;
  organizationId: string;

  // Trigger context
  triggerId: string;
  triggerType: TriggerType;
  triggerData?: Record<string, unknown>;

  // Execution state
  status: InstanceStatus;
  currentStepId?: string;
  stepExecutions: StepExecution[];
  variables: Record<string, unknown>;
  completedStepIds: string[];

  // Correlation
  correlationId?: string;
  parentInstanceId?: string;
  childInstanceIds?: string[];

  // Timing
  createdAt: string;
  startedAt?: string;
  completedAt?: string;

  // Error tracking
  lastError?: ExecutionError & { stepId: string; timestamp: string };
  errorCount?: number;

  // Actor context
  initiatedBy?: string;

  // Compensation tracking
  compensationRequired?: boolean;
  compensatedStepIds?: string[];

  // TTL for automatic cleanup
  ttl?: number;
}

// ----------------------------------------------------------------------------
// Workflow Trigger (Registry Entry)
// ----------------------------------------------------------------------------

export interface WorkflowTrigger {
  id: string;
  triggerId: string;
  eventType: string;
  workflowId: string;
  workflowVersion?: number;
  organizationId: string;
  isActive: boolean;
  eventFilter?: string;
  extractVariables?: Record<string, string>;
  priority?: number;
  createdAt: string;
  updatedAt?: string;
}

// ----------------------------------------------------------------------------
// Approval Request
// ----------------------------------------------------------------------------

export interface ApprovalRequest {
  id: string;
  approvalId: string;
  instanceId: string;
  workflowId: string;
  stepId: string;
  stepName: string;
  organizationId: string;

  // Approval configuration
  approverRoles?: string[];
  approverUsers?: string[];
  requiredApprovals: number;
  currentApprovals: number;

  // Context
  context: Record<string, unknown>;
  requestedAt: string;
  expiresAt?: string;

  // Status
  status: ApprovalStatus;
  decisions: ApprovalDecision[];

  // Escalation
  escalatedAt?: string;
  escalatedTo?: string[];

  // TTL
  ttl?: number;
}

export interface ApprovalDecision {
  userId: string;
  userName?: string;
  decision: 'approved' | 'rejected';
  comment?: string;
  data?: Record<string, unknown>;
  decidedAt: string;
}

// ----------------------------------------------------------------------------
// Workflow Filters
// ----------------------------------------------------------------------------

export interface WorkflowFilters {
  status?: WorkflowStatus | WorkflowStatus[];
  organizationId?: string;
  category?: string;
  tags?: string[];
  search?: string;
  includeDeleted?: boolean;
}

export interface InstanceFilters {
  workflowId?: string;
  status?: InstanceStatus | InstanceStatus[];
  organizationId?: string;
  correlationId?: string;
  startDateFrom?: string;
  startDateTo?: string;
  initiatedBy?: string;
}

// ----------------------------------------------------------------------------
// API Request/Response Types
// ----------------------------------------------------------------------------

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  organizationId: string;
  triggers?: TriggerDefinition[];
  steps?: WorkflowStep[];
  variables?: Record<string, VariableDefinition>;
  settings?: WorkflowSettings;
  tags?: string[];
  category?: string;
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  triggers?: TriggerDefinition[];
  steps?: WorkflowStep[];
  variables?: Record<string, VariableDefinition>;
  settings?: WorkflowSettings;
  tags?: string[];
  category?: string;
}

export interface AddStepRequest {
  step: Omit<WorkflowStep, 'id'>;
  afterStepId?: string;
}

export interface UpdateStepRequest {
  step: Partial<Omit<WorkflowStep, 'id'>>;
}

export interface ReorderStepsRequest {
  stepOrder: Array<{ stepId: string; order: number }>;
}

export interface StartWorkflowRequest {
  variables?: Record<string, unknown>;
  correlationId?: string;
  initiatedBy?: string;
}

export interface ApprovalActionRequest {
  decision: 'approved' | 'rejected';
  comment?: string;
  data?: Record<string, unknown>;
}

export interface ReassignApprovalRequest {
  toUserId: string;
  reason?: string;
}

// ----------------------------------------------------------------------------
// Execution Context (used by step executors)
// ----------------------------------------------------------------------------

export interface ExecutionContext {
  instanceId: string;
  workflowId: string;
  workflowVersion: number;
  organizationId: string;
  variables: Record<string, unknown>;
  stepOutputs: Record<string, unknown>;
  correlationId?: string;
  parentInstanceId?: string;
}

export interface StepResult {
  success: boolean;
  output?: unknown;
  error?: ExecutionError;
  nextStepId?: string;
  shouldTerminate?: boolean;
  variableUpdates?: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// Events Published by Workflow Service
// ----------------------------------------------------------------------------

export interface WorkflowInstanceStartedEventData {
  instanceId: string;
  workflowId: string;
  workflowName: string;
  organizationId: string;
  triggerId: string;
  triggerType: TriggerType;
  correlationId?: string;
}

export interface WorkflowInstanceCompletedEventData {
  instanceId: string;
  workflowId: string;
  workflowName: string;
  organizationId: string;
  durationMs: number;
  finalVariables: Record<string, unknown>;
}

export interface WorkflowInstanceFailedEventData {
  instanceId: string;
  workflowId: string;
  workflowName: string;
  organizationId: string;
  error: ExecutionError;
  failedStepId: string;
  failedStepName: string;
}

export interface WorkflowStepCompletedEventData {
  instanceId: string;
  workflowId: string;
  stepId: string;
  stepName: string;
  stepType: StepType;
  durationMs: number;
  output?: unknown;
}

export interface WorkflowApprovalRequiredEventData {
  approvalId: string;
  instanceId: string;
  workflowId: string;
  workflowName: string;
  stepId: string;
  stepName: string;
  approverRoles?: string[];
  approverUsers?: string[];
  context: Record<string, unknown>;
  expiresAt?: string;
}

export interface WorkflowApprovalCompletedEventData {
  approvalId: string;
  instanceId: string;
  workflowId: string;
  stepId: string;
  decision: 'approved' | 'rejected';
  decidedBy: string;
  comment?: string;
}

// ----------------------------------------------------------------------------
// Workflow Templates
// ----------------------------------------------------------------------------

export interface WorkflowTemplate {
  id: string;
  templateId: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  baseWorkflow: {
    triggers: TriggerDefinition[];
    steps: WorkflowStep[];
    variables: Record<string, VariableDefinition>;
    settings?: WorkflowSettings;
  };
  requiredVariables: string[];
  configurationSchema?: Record<string, unknown>;
  previewImage?: string;
  documentation?: string;
  isPublic: boolean;
  organizationId?: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
  version: number;
}

export interface TemplateFilters {
  category?: string;
  tags?: string[];
  isPublic?: boolean;
  organizationId?: string;
  search?: string;
}

export interface CreateTemplateRequest {
  name: string;
  description: string;
  category: string;
  tags?: string[];
  baseWorkflow: {
    triggers: TriggerDefinition[];
    steps: WorkflowStep[];
    variables: Record<string, VariableDefinition>;
    settings?: WorkflowSettings;
  };
  requiredVariables?: string[];
  configurationSchema?: Record<string, unknown>;
  previewImage?: string;
  documentation?: string;
  isPublic?: boolean;
  organizationId?: string;
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  baseWorkflow?: {
    triggers?: TriggerDefinition[];
    steps?: WorkflowStep[];
    variables?: Record<string, VariableDefinition>;
    settings?: WorkflowSettings;
  };
  requiredVariables?: string[];
  configurationSchema?: Record<string, unknown>;
  previewImage?: string;
  documentation?: string;
  isPublic?: boolean;
}

export interface CreateFromTemplateRequest {
  templateId: string;
  name: string;
  description?: string;
  organizationId: string;
  configuration?: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// Canvas State (for visual designer sync)
// ----------------------------------------------------------------------------

export interface CanvasState {
  id: string;
  workflowId: string;
  version: number;
  nodePositions: Record<string, { x: number; y: number }>;
  viewport: { x: number; y: number; zoom: number };
  updatedAt: string;
  updatedBy: string;
}

export interface SaveCanvasRequest {
  nodePositions: Record<string, { x: number; y: number }>;
  viewport: { x: number; y: number; zoom: number };
}

// ----------------------------------------------------------------------------
// Analytics Types
// ----------------------------------------------------------------------------

export type AnalyticsPeriod = 'day' | 'week' | 'month';

export interface StepAnalytics {
  stepId: string;
  stepName: string;
  stepType: StepType;
  executionCount: number;
  successCount: number;
  failureCount: number;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  errorRate: number;
}

export interface ApprovalAnalytics {
  totalApprovals: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  avgDecisionTimeMs: number;
  escalationRate: number;
}

export interface WorkflowAnalytics {
  workflowId: string;
  workflowName: string;
  period: AnalyticsPeriod;
  periodStart: string;
  periodEnd: string;
  totalExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  cancelledExecutions: number;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  successRate: number;
  stepMetrics: StepAnalytics[];
  approvalMetrics?: ApprovalAnalytics;
}

export interface AnalyticsOverview {
  organizationId: string;
  period: AnalyticsPeriod;
  periodStart: string;
  periodEnd: string;
  totalWorkflows: number;
  activeWorkflows: number;
  totalExecutions: number;
  successRate: number;
  avgDurationMs: number;
  topWorkflows: Array<{
    workflowId: string;
    workflowName: string;
    executionCount: number;
    successRate: number;
  }>;
  slowestSteps: StepAnalytics[];
  failingSteps: StepAnalytics[];
}

