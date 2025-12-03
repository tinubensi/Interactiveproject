import {
  ScriptConfig,
  StepResult,
  ExecutionError
} from '../../models/workflowTypes';
import { ExpressionContext } from '../engine/expressionResolver';

export interface ScriptExecutorResult {
  success: boolean;
  data?: unknown;
  error?: ExecutionError;
}

// Safe globals that scripts can access
const SAFE_GLOBALS: Record<string, unknown> = {
  Math,
  Date,
  JSON,
  String,
  Number,
  Boolean,
  Array,
  Object,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  encodeURIComponent,
  decodeURIComponent,
  encodeURI,
  decodeURI
};

/**
 * Execute a script in a sandboxed environment
 * Note: This is a simplified implementation. For production, consider using
 * a proper sandbox like vm2 or isolated-vm for better security.
 */
export const executeScript = async (
  config: ScriptConfig,
  context: ExpressionContext
): Promise<ScriptExecutorResult> => {
  const timeout = config.timeout || 5000;
  
  try {
    // Build allowed globals
    const allowedGlobals: Record<string, unknown> = {};
    const globalNames = config.allowedGlobals || Object.keys(SAFE_GLOBALS);
    
    for (const name of globalNames) {
      if (name in SAFE_GLOBALS) {
        allowedGlobals[name] = SAFE_GLOBALS[name];
      }
    }

    // Prepare script context
    const scriptContext = {
      $: context.variables,
      input: context.input,
      steps: context.stepOutputs,
      ...allowedGlobals
    };

    // Create a function from the script
    // The script should return a value
    const scriptFunction = new Function(
      ...Object.keys(scriptContext),
      `
        "use strict";
        ${config.code}
      `
    );

    // Execute with timeout
    const result = await Promise.race([
      Promise.resolve(scriptFunction(...Object.values(scriptContext))),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Script execution timeout')), timeout)
      )
    ]);

    return {
      success: true,
      data: result
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'SCRIPT_ERROR',
        message: error instanceof Error ? error.message : 'Script execution failed',
        details: error instanceof Error ? error.stack : undefined
      }
    };
  }
};

/**
 * Convert script result to step result
 */
export const scriptResultToStepResult = (
  result: ScriptExecutorResult,
  outputVariable?: string
): StepResult => {
  const variableUpdates: Record<string, unknown> = {};
  
  if (result.success && outputVariable && result.data !== undefined) {
    variableUpdates[outputVariable] = result.data;
  }

  return {
    success: result.success,
    output: result.data,
    error: result.error,
    shouldTerminate: false,
    variableUpdates: Object.keys(variableUpdates).length > 0 ? variableUpdates : undefined
  };
};

