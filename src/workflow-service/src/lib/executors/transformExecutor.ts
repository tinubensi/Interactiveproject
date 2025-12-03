import jsonata from 'jsonata';
import {
  TransformConfig,
  StepResult,
  ExecutionError
} from '../../models/workflowTypes';
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
export const executeTransform = async (
  config: TransformConfig,
  context: ExpressionContext
): Promise<TransformExecutorResult> => {
  try {
    // Compile the JSONata expression
    const expression = jsonata(config.expression);

    // Prepare the input data - make variables available at root level for $. access
    const inputData = {
      ...context.variables,
      $: context.variables,
      steps: context.stepOutputs,
      input: context.input,
      env: process.env
    };

    // Evaluate the expression
    const result = await expression.evaluate(inputData);

    return {
      success: true,
      data: result,
      outputVariable: config.outputVariable
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'TRANSFORM_ERROR',
        message: error instanceof Error ? error.message : 'Transform failed',
        details: error instanceof Error ? error.stack : undefined
      }
    };
  }
};

/**
 * Convert transform result to step result
 */
export const transformResultToStepResult = (
  result: TransformExecutorResult
): StepResult => {
  const variableUpdates: Record<string, unknown> = {};
  
  if (result.success && result.outputVariable && result.data !== undefined) {
    variableUpdates[result.outputVariable] = result.data;
  }

  return {
    success: result.success,
    output: result.data,
    error: result.error,
    shouldTerminate: false,
    variableUpdates: Object.keys(variableUpdates).length > 0 ? variableUpdates : undefined
  };
};

