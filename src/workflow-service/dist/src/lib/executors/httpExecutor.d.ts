import { HttpRequestConfig, StepResult, ExecutionError } from '../../models/workflowTypes';
import { ExpressionContext } from '../engine/expressionResolver';
export interface HttpExecutorConfig extends Omit<HttpRequestConfig, 'auth'> {
    auth?: {
        type: 'bearer' | 'basic' | 'api-key';
        token?: string;
        username?: string;
        password?: string;
        headerName?: string;
        apiKey?: string;
    };
}
export interface HttpExecutorResult {
    success: boolean;
    data?: unknown;
    statusCode?: number;
    headers?: Record<string, string>;
    error?: ExecutionError;
}
/**
 * Execute an HTTP request
 */
export declare const executeHttpRequest: (config: HttpExecutorConfig, context: ExpressionContext) => Promise<HttpExecutorResult>;
/**
 * Create a step result from HTTP executor result
 */
export declare const httpResultToStepResult: (result: HttpExecutorResult) => StepResult;
//# sourceMappingURL=httpExecutor.d.ts.map