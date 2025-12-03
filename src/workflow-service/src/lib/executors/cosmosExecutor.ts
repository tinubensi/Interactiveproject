import { getCosmosContainers } from '../cosmosClient';
import {
  CosmosQueryConfig,
  CosmosUpsertConfig,
  CosmosDeleteConfig,
  StepResult,
  ExecutionError
} from '../../models/workflowTypes';
import {
  ExpressionContext,
  resolveTemplate,
  resolveObject
} from '../engine/expressionResolver';

export interface CosmosExecutorResult {
  success: boolean;
  data?: unknown;
  error?: ExecutionError;
}

/**
 * Execute a Cosmos DB query
 */
export const executeCosmosQuery = async (
  config: CosmosQueryConfig,
  context: ExpressionContext
): Promise<CosmosExecutorResult> => {
  try {
    const containers = await getCosmosContainers();
    
    // Resolve the query and parameters
    const query = resolveTemplate(config.query, context);
    const parameters: Array<{ name: string; value: string | number | boolean | null }> = config.parameters
      ? Object.entries(config.parameters).map(([name, value]) => ({
          name: name.startsWith('@') ? name : `@${name}`,
          value: (typeof value === 'string' ? resolveTemplate(value, context) : value) as string | number | boolean | null
        }))
      : [];

    // Get the container - for now, we use workflowInstances as a general-purpose container
    // In production, this would need to be more flexible
    const container = containers.workflowInstances;

    const { resources } = await container.items
      .query({ query, parameters })
      .fetchAll();

    return {
      success: true,
      data: resources
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'COSMOS_QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Query failed'
      }
    };
  }
};

/**
 * Execute a Cosmos DB upsert
 */
export const executeCosmosUpsert = async (
  config: CosmosUpsertConfig,
  context: ExpressionContext
): Promise<CosmosExecutorResult> => {
  try {
    const containers = await getCosmosContainers();
    
    // Resolve the document
    const document = resolveObject(config.document, context) as Record<string, unknown>;

    // Get the container
    const container = containers.workflowInstances;

    const { resource } = await container.items.upsert(document);

    return {
      success: true,
      data: resource
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'COSMOS_UPSERT_ERROR',
        message: error instanceof Error ? error.message : 'Upsert failed'
      }
    };
  }
};

/**
 * Execute a Cosmos DB delete
 */
export const executeCosmosDelete = async (
  config: CosmosDeleteConfig,
  context: ExpressionContext
): Promise<CosmosExecutorResult> => {
  try {
    const containers = await getCosmosContainers();
    
    // Resolve the document ID and partition key
    const documentId = resolveTemplate(config.documentId, context);
    const partitionKey = resolveTemplate(config.partitionKey, context);

    // Get the container
    const container = containers.workflowInstances;

    await container.item(documentId, partitionKey).delete();

    return {
      success: true,
      data: { deleted: true, documentId }
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'COSMOS_DELETE_ERROR',
        message: error instanceof Error ? error.message : 'Delete failed'
      }
    };
  }
};

/**
 * Convert cosmos result to step result
 */
export const cosmosResultToStepResult = (
  result: CosmosExecutorResult
): StepResult => {
  return {
    success: result.success,
    output: result.data,
    error: result.error,
    shouldTerminate: false
  };
};

