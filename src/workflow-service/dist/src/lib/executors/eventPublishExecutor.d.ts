import { PublishEventConfig, StepResult, ExecutionError } from '../../models/workflowTypes';
import { ExpressionContext } from '../engine/expressionResolver';
export interface EventPublishResult {
    success: boolean;
    eventId?: string;
    error?: ExecutionError;
}
/**
 * Execute an event publish action
 */
export declare const executeEventPublish: (config: PublishEventConfig, context: ExpressionContext) => Promise<EventPublishResult>;
/**
 * Convert event publish result to step result
 */
export declare const eventPublishResultToStepResult: (result: EventPublishResult) => StepResult;
//# sourceMappingURL=eventPublishExecutor.d.ts.map