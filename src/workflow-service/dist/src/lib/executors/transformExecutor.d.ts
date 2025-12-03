import { TransformConfig, StepResult, ExecutionError } from '../../models/workflowTypes';
import { ExpressionContext } from '../engine/expressionResolver';
export interface TransformExecutorResult {
    success: boolean;
    data?: unknown;
    outputVariable?: string;
    error?: ExecutionError;
}
/**
 * Execute a JSONata transformation
 */
export declare const executeTransform: (config: TransformConfig, context: ExpressionContext) => Promise<TransformExecutorResult>;
/**
 * Convert transform result to step result
 */
export declare const transformResultToStepResult: (result: TransformExecutorResult) => StepResult;
//# sourceMappingURL=transformExecutor.d.ts.map