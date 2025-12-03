import {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowStep,
  StepExecution,
  StepExecutionStatus,
  InstanceStatus,
  ExecutionContext,
  StepResult,
  ExecutionError
} from '../../models/workflowTypes';
import {
  getInstance,
  updateInstanceStatus,
  updateCurrentStep,
  updateVariables
} from '../repositories/instanceRepository';
import { getWorkflowByVersion } from '../repositories/workflowRepository';
import { executeStep, determineNextStep } from '../executors/stepExecutorDispatcher';
import { ExpressionContext } from './expressionResolver';

export interface OrchestratorResult {
  instanceId: string;
  status: InstanceStatus;
  completedSteps: string[];
  currentStepId?: string;
  variables: Record<string, unknown>;
  error?: ExecutionError;
}

export interface OrchestratorOptions {
  maxSteps?: number;
  timeout?: number;
  onStepStart?: (stepId: string, stepName: string) => Promise<void>;
  onStepComplete?: (stepId: string, result: StepResult) => Promise<void>;
  onError?: (stepId: string, error: ExecutionError) => Promise<void>;
}

/**
 * Execute a workflow instance
 * This is the main orchestration function that runs the workflow
 */
export const executeWorkflow = async (
  instanceId: string,
  options: OrchestratorOptions = {}
): Promise<OrchestratorResult> => {
  const maxSteps = options.maxSteps || 1000;
  let stepCount = 0;

  // Get the instance
  let instance = await getInstance(instanceId);

  // Get the workflow definition
  const workflow = await getWorkflowByVersion(
    instance.workflowId,
    instance.workflowVersion
  );

  // Update status to running
  instance = await updateInstanceStatus(instanceId, 'running');

  // Sort steps by order
  const sortedSteps = [...workflow.steps].sort((a, b) => a.order - b.order);

  // Find starting step
  let currentStepId = instance.currentStepId;
  if (!currentStepId && sortedSteps.length > 0) {
    currentStepId = sortedSteps[0].id;
  }

  if (!currentStepId) {
    return {
      instanceId,
      status: 'completed',
      completedSteps: [],
      variables: instance.variables
    };
  }

  // Execute steps
  while (currentStepId && stepCount < maxSteps) {
    stepCount++;

    // Find the current step
    const currentStep = sortedSteps.find((s) => s.id === currentStepId);
    if (!currentStep) {
      throw new Error(`Step ${currentStepId} not found in workflow`);
    }

    // Notify step start
    if (options.onStepStart) {
      await options.onStepStart(currentStep.id, currentStep.name);
    }

    // Create step execution record
    const stepExecution: StepExecution = {
      stepId: currentStep.id,
      stepName: currentStep.name,
      stepType: currentStep.type,
      status: 'running',
      startedAt: new Date().toISOString(),
      input: instance.variables
    };

    // Update instance with current step
    instance = await updateCurrentStep(instanceId, currentStepId, stepExecution);

    // Create execution context
    const executionContext: ExecutionContext = {
      instanceId: instance.instanceId,
      workflowId: instance.workflowId,
      workflowVersion: instance.workflowVersion,
      organizationId: instance.organizationId,
      variables: instance.variables,
      stepOutputs: buildStepOutputs(instance.stepExecutions),
      correlationId: instance.correlationId,
      parentInstanceId: instance.parentInstanceId
    };

    // Execute the step
    let result: StepResult;
    try {
      result = await executeStep(currentStep, executionContext);
    } catch (error) {
      result = {
        success: false,
        error: {
          code: 'STEP_EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        shouldTerminate: false
      };
    }

    // Update step execution record
    const updatedStepExecution: StepExecution = {
      ...stepExecution,
      status: result.success ? 'completed' : 'failed',
      completedAt: new Date().toISOString(),
      output: result.output as Record<string, unknown>,
      error: result.error,
      durationMs:
        Date.now() - new Date(stepExecution.startedAt!).getTime()
    };

    instance = await updateCurrentStep(
      instanceId,
      currentStepId,
      updatedStepExecution
    );

    // Notify step complete
    if (options.onStepComplete) {
      await options.onStepComplete(currentStep.id, result);
    }

    // Handle variable updates
    if (result.variableUpdates) {
      instance = await updateVariables(instanceId, result.variableUpdates);
    }

    // Handle step failure
    if (!result.success) {
      // Check for error handler
      if (currentStep.onError) {
        const handled = await handleStepError(
          instance,
          currentStep,
          result.error!,
          options
        );
        if (handled.retry) {
          continue;
        }
        if (handled.nextStepId) {
          currentStepId = handled.nextStepId;
          continue;
        }
      }

      // Notify error
      if (options.onError) {
        await options.onError(currentStep.id, result.error!);
      }

      // Update status to failed
      await updateInstanceStatus(instanceId, 'failed', {
        lastError: {
          stepId: currentStep.id,
          ...result.error!,
          timestamp: new Date().toISOString()
        }
      });

      return {
        instanceId,
        status: 'failed',
        completedSteps: instance.completedStepIds,
        currentStepId: currentStep.id,
        variables: instance.variables,
        error: result.error
      };
    }

    // Check for termination
    if (result.shouldTerminate) {
      break;
    }

    // Check for orchestration requirements (wait, parallel, subworkflow)
    if (result.output && typeof result.output === 'object') {
      const output = result.output as Record<string, unknown>;
      if (output.requiresOrchestration) {
        // Handle special step types
        const orchestrationResult = await handleOrchestrationStep(
          instance,
          currentStep,
          result,
          workflow
        );
        
        if (orchestrationResult.waiting) {
          await updateInstanceStatus(instanceId, 'waiting');
          return {
            instanceId,
            status: 'waiting',
            completedSteps: instance.completedStepIds,
            currentStepId: currentStep.id,
            variables: instance.variables
          };
        }
        
        if (orchestrationResult.nextStepId) {
          currentStepId = orchestrationResult.nextStepId;
          continue;
        }
      }
    }

    // Determine next step
    const exprContext: ExpressionContext = {
      variables: instance.variables,
      stepOutputs: buildStepOutputs(instance.stepExecutions),
      input: instance.triggerData || {}
    };

    const nextStepId = determineNextStep(
      currentStep,
      sortedSteps,
      exprContext,
      result
    );

    currentStepId = nextStepId || undefined;
  }

  // Workflow completed
  await updateInstanceStatus(instanceId, 'completed');

  return {
    instanceId,
    status: 'completed',
    completedSteps: instance.completedStepIds,
    variables: instance.variables
  };
};

/**
 * Build step outputs from step executions
 */
const buildStepOutputs = (
  stepExecutions: StepExecution[]
): Record<string, unknown> => {
  const outputs: Record<string, unknown> = {};
  
  for (const execution of stepExecutions) {
    if (execution.status === 'completed' && execution.output) {
      outputs[execution.stepId] = execution.output;
    }
  }
  
  return outputs;
};

/**
 * Handle step error based on error handler configuration
 */
const handleStepError = async (
  instance: WorkflowInstance,
  step: WorkflowStep,
  error: ExecutionError,
  options: OrchestratorOptions
): Promise<{ retry: boolean; nextStepId?: string }> => {
  if (!step.onError) {
    return { retry: false };
  }

  const errorHandler = step.onError;

  switch (errorHandler.action) {
    case 'skip':
      // Skip this step, continue to next
      return { retry: false };

    case 'retry':
      if (errorHandler.retryPolicy) {
        const currentExecution = instance.stepExecutions.find(
          (s) => s.stepId === step.id
        );
        const retryCount = currentExecution?.retryCount || 0;
        
        if (retryCount < errorHandler.retryPolicy.maxAttempts) {
          // Check if error is retryable
          const retryableErrors = errorHandler.retryPolicy.retryableErrors || [];
          if (retryableErrors.length === 0 || retryableErrors.includes(error.code)) {
            // Wait before retry
            const delay = calculateRetryDelay(
              retryCount,
              errorHandler.retryPolicy.initialDelaySeconds,
              errorHandler.retryPolicy.backoffType,
              errorHandler.retryPolicy.maxDelaySeconds
            );
            await sleep(delay * 1000);
            return { retry: true };
          }
        }
      }
      return { retry: false };

    case 'goto':
      if (errorHandler.fallbackStepId) {
        return { retry: false, nextStepId: errorHandler.fallbackStepId };
      }
      return { retry: false };

    case 'compensate':
      // TODO: Implement compensation logic
      return { retry: false };

    case 'fail':
    default:
      return { retry: false };
  }
};

/**
 * Calculate retry delay based on backoff policy
 */
const calculateRetryDelay = (
  retryCount: number,
  initialDelay: number,
  backoffType: 'fixed' | 'exponential',
  maxDelay?: number
): number => {
  let delay: number;
  
  if (backoffType === 'exponential') {
    delay = initialDelay * Math.pow(2, retryCount);
  } else {
    delay = initialDelay;
  }
  
  if (maxDelay && delay > maxDelay) {
    delay = maxDelay;
  }
  
  return delay;
};

/**
 * Handle steps that require orchestration (wait, parallel, subworkflow, loop)
 */
const handleOrchestrationStep = async (
  instance: WorkflowInstance,
  step: WorkflowStep,
  result: StepResult,
  workflow: WorkflowDefinition
): Promise<{ waiting: boolean; nextStepId?: string }> => {
  const output = result.output as Record<string, unknown>;

  switch (step.type) {
    case 'wait':
      // Wait steps require external event or timer
      return { waiting: true };

    case 'delay':
      // For delay steps, we could implement a simple sleep
      // In production, this would use Durable Functions timers
      const delaySeconds = output.delaySeconds as number;
      if (delaySeconds > 0) {
        await sleep(delaySeconds * 1000);
      }
      return { waiting: false };

    case 'parallel':
      // TODO: Implement parallel execution
      return { waiting: false };

    case 'loop':
      // TODO: Implement loop execution
      return { waiting: false };

    case 'subworkflow':
      // TODO: Implement subworkflow execution
      return { waiting: false };

    case 'human':
      // Human approval steps require external approval
      return { waiting: true };

    default:
      return { waiting: false };
  }
};

/**
 * Resume a waiting workflow instance
 */
export const resumeWorkflow = async (
  instanceId: string,
  eventData?: Record<string, unknown>,
  options: OrchestratorOptions = {}
): Promise<OrchestratorResult> => {
  const instance = await getInstance(instanceId);

  if (instance.status !== 'waiting' && instance.status !== 'paused') {
    throw new Error(
      `Cannot resume instance with status ${instance.status}`
    );
  }

  // Update variables with event data if provided
  if (eventData) {
    await updateVariables(instanceId, { eventData });
  }

  // Continue execution
  return executeWorkflow(instanceId, options);
};

/**
 * Sleep utility
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

