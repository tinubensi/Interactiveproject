/**
 * Pipeline Definition Schema Validation
 * Uses Zod to validate pipeline definitions at seed time
 */

import { z } from 'zod';

// Zod schemas for pipeline definition
const SyncActionSchema = z.object({
  targetService: z.string().min(1),
  endpoint: z.string().startsWith('/api/'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  requiredData: z.array(z.string()),
  timeout: z.number().min(1000).max(60000),
  onSuccess: z.object({
    nextStage: z.string().optional(),
    updateData: z.record(z.any()).optional(),
  }).optional(),
  onFailure: z.object({
    retryPolicy: z.object({
      maxRetries: z.number().min(0).max(5),
      delayMs: z.number().min(1000),
    }).optional(),
    fallbackStage: z.string().optional(),
  }).optional(),
});

const AsyncActionSchema = z.object({
  targetService: z.string().min(1),
  actionEvent: z.string().startsWith('pipeline.action.'),
  requiredData: z.array(z.string()),
  completionEvent: z.string().startsWith('service.'),
  timeout: z.number().min(10000).max(600000),
  retryPolicy: z.object({
    maxRetries: z.number().min(0).max(3),
    retryDelayMs: z.number().min(10000),
  }).optional(),
});

const ActionConfigSchema = z.object({
  primaryAction: z.object({
    type: z.enum(['sync', 'async', 'manual', 'wait']),
    syncAction: SyncActionSchema.optional(),
    asyncAction: AsyncActionSchema.optional(),
  }).optional(),
  allowedUserActions: z.array(z.object({
    actionId: z.string(),
    actionName: z.string(),
    actionType: z.enum(['sync', 'async']),
    requiresApproval: z.boolean(),
    requiresPermission: z.string().optional(),
    syncAction: SyncActionSchema.optional(),
    asyncAction: AsyncActionSchema.optional(),
    nextStepOverride: z.string().optional(),
  })).optional(),
  autoAdvance: z.object({
    enabled: z.boolean(),
    delayMs: z.number().min(0).optional(),
    condition: z.string().optional(),
  }).optional(),
}).optional();

const StageMetadataSchema = z.object({
  estimatedDuration: z.number().min(0),
  requiresUserInput: z.boolean(),
  canSkip: z.boolean(),
  exitConditions: z.array(z.string()),
});

const EnhancedStageStepSchema = z.object({
  id: z.string().uuid(),
  order: z.number().positive(),
  type: z.literal('stage'),
  stageId: z.string(),
  stageName: z.string().min(1),
  name: z.string().optional(),
  description: z.string().optional(),
  enabled: z.boolean(),
  actionConfig: ActionConfigSchema,
  metadata: StageMetadataSchema,
});

// Base step schema for non-enhanced steps
const BaseStepSchema = z.object({
  id: z.string().uuid(),
  order: z.number().positive(),
  enabled: z.boolean(),
  name: z.string().optional(),
  description: z.string().optional(),
});

// Wait step schema
const WaitStepSchema = BaseStepSchema.extend({
  type: z.literal('wait'),
  waitForEvent: z.string(),
  timeoutHours: z.number().optional(),
  onTimeoutStepId: z.string().optional(),
});

// Decision step schema
const DecisionStepSchema = BaseStepSchema.extend({
  type: z.literal('decision'),
  conditionType: z.string(),
  conditionValue: z.union([z.string(), z.number()]).optional(),
  trueNextStepId: z.string(),
  falseNextStepId: z.string(),
});

// Approval step schema
const ApprovalStepSchema = BaseStepSchema.extend({
  type: z.literal('approval'),
  approverRole: z.string(),
  timeoutHours: z.number().optional(),
  escalationRole: z.string().optional(),
});

// Notification step schema
const NotificationStepSchema = BaseStepSchema.extend({
  type: z.literal('notification'),
  notificationType: z.string(),
  customMessage: z.string().optional(),
});

// Discriminated union of all step types
const PipelineStepSchema = z.discriminatedUnion('type', [
  EnhancedStageStepSchema,
  WaitStepSchema,
  DecisionStepSchema,
  ApprovalStepSchema,
  NotificationStepSchema,
]);

const PipelineDefinitionSchema = z.object({
  pipelineId: z.string().uuid(),
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.number().positive(),
  lineOfBusiness: z.enum(['medical', 'motor', 'general', 'marine']),
  businessType: z.enum(['individual', 'group']).optional(),
  organizationId: z.string().optional(),
  status: z.enum(['draft', 'active', 'inactive', 'deprecated']),
  isDefault: z.boolean().optional(),
  steps: z.array(PipelineStepSchema).min(1),
  entryStepId: z.string().uuid(),
  createdAt: z.string(),
  createdBy: z.string(),
  updatedAt: z.string().optional(),
  updatedBy: z.string().optional(),
  activatedAt: z.string().optional(),
  activatedBy: z.string().optional(),
});

/**
 * Validate pipeline definition
 */
export function validatePipelineDefinition(pipeline: any): void {
  try {
    PipelineDefinitionSchema.parse(pipeline);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const errorMessages = err.errors.map((e: any) => 
        `${e.path.join('.')}: ${e.message}`
      ).join(', ');
      throw new Error(`Pipeline validation failed: ${errorMessages}`);
    }
    throw err;
  }
}

