import { CosmosQueryConfig, CosmosUpsertConfig, CosmosDeleteConfig, StepResult, ExecutionError } from '../../models/workflowTypes';
import { ExpressionContext } from '../engine/expressionResolver';
export interface CosmosExecutorResult {
    success: boolean;
    data?: unknown;
    error?: ExecutionError;
}
/**
 * Execute a Cosmos DB query
 */
export declare const executeCosmosQuery: (config: CosmosQueryConfig, context: ExpressionContext) => Promise<CosmosExecutorResult>;
/**
 * Execute a Cosmos DB upsert
 */
export declare const executeCosmosUpsert: (config: CosmosUpsertConfig, context: ExpressionContext) => Promise<CosmosExecutorResult>;
/**
 * Execute a Cosmos DB delete
 */
export declare const executeCosmosDelete: (config: CosmosDeleteConfig, context: ExpressionContext) => Promise<CosmosExecutorResult>;
/**
 * Convert cosmos result to step result
 */
export declare const cosmosResultToStepResult: (result: CosmosExecutorResult) => StepResult;
//# sourceMappingURL=cosmosExecutor.d.ts.map