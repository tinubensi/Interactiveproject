import { ScriptConfig, StepResult, ExecutionError } from '../../models/workflowTypes';
import { ExpressionContext } from '../engine/expressionResolver';
export interface ScriptExecutorResult {
    success: boolean;
    data?: unknown;
    error?: ExecutionError;
}
/**
 * Execute a script in a sandboxed environment
 * Note: This is a simplified implementation. For production, consider using
 * a proper sandbox like vm2 or isolated-vm for better security.
 */
export declare const executeScript: (config: ScriptConfig, context: ExpressionContext) => Promise<ScriptExecutorResult>;
/**
 * Convert script result to step result
 */
export declare const scriptResultToStepResult: (result: ScriptExecutorResult, outputVariable?: string) => StepResult;
//# sourceMappingURL=scriptExecutor.d.ts.map