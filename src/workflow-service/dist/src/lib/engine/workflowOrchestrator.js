"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resumeWorkflow = exports.executeWorkflow = void 0;
const instanceRepository_1 = require("../repositories/instanceRepository");
const workflowRepository_1 = require("../repositories/workflowRepository");
const stepExecutorDispatcher_1 = require("../executors/stepExecutorDispatcher");
/**
 * Execute a workflow instance
 * This is the main orchestration function that runs the workflow
 */
const executeWorkflow = async (instanceId, options = {}) => {
    const maxSteps = options.maxSteps || 1000;
    let stepCount = 0;
    // Get the instance
    let instance = await (0, instanceRepository_1.getInstance)(instanceId);
    // Get the workflow definition
    const workflow = await (0, workflowRepository_1.getWorkflowByVersion)(instance.workflowId, instance.workflowVersion);
    // Update status to running
    instance = await (0, instanceRepository_1.updateInstanceStatus)(instanceId, 'running');
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
        const stepExecution = {
            stepId: currentStep.id,
            stepName: currentStep.name,
            stepType: currentStep.type,
            status: 'running',
            startedAt: new Date().toISOString(),
            input: instance.variables
        };
        // Update instance with current step
        instance = await (0, instanceRepository_1.updateCurrentStep)(instanceId, currentStepId, stepExecution);
        // Create execution context
        const executionContext = {
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
        let result;
        try {
            result = await (0, stepExecutorDispatcher_1.executeStep)(currentStep, executionContext);
        }
        catch (error) {
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
        const updatedStepExecution = {
            ...stepExecution,
            status: result.success ? 'completed' : 'failed',
            completedAt: new Date().toISOString(),
            output: result.output,
            error: result.error,
            durationMs: Date.now() - new Date(stepExecution.startedAt).getTime()
        };
        instance = await (0, instanceRepository_1.updateCurrentStep)(instanceId, currentStepId, updatedStepExecution);
        // Notify step complete
        if (options.onStepComplete) {
            await options.onStepComplete(currentStep.id, result);
        }
        // Handle variable updates
        if (result.variableUpdates) {
            instance = await (0, instanceRepository_1.updateVariables)(instanceId, result.variableUpdates);
        }
        // Handle step failure
        if (!result.success) {
            // Check for error handler
            if (currentStep.onError) {
                const handled = await handleStepError(instance, currentStep, result.error, options);
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
                await options.onError(currentStep.id, result.error);
            }
            // Update status to failed
            await (0, instanceRepository_1.updateInstanceStatus)(instanceId, 'failed', {
                lastError: {
                    stepId: currentStep.id,
                    ...result.error,
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
            const output = result.output;
            if (output.requiresOrchestration) {
                // Handle special step types
                const orchestrationResult = await handleOrchestrationStep(instance, currentStep, result, workflow);
                if (orchestrationResult.waiting) {
                    await (0, instanceRepository_1.updateInstanceStatus)(instanceId, 'waiting');
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
        const exprContext = {
            variables: instance.variables,
            stepOutputs: buildStepOutputs(instance.stepExecutions),
            input: instance.triggerData || {}
        };
        const nextStepId = (0, stepExecutorDispatcher_1.determineNextStep)(currentStep, sortedSteps, exprContext, result);
        currentStepId = nextStepId || undefined;
    }
    // Workflow completed
    await (0, instanceRepository_1.updateInstanceStatus)(instanceId, 'completed');
    return {
        instanceId,
        status: 'completed',
        completedSteps: instance.completedStepIds,
        variables: instance.variables
    };
};
exports.executeWorkflow = executeWorkflow;
/**
 * Build step outputs from step executions
 */
const buildStepOutputs = (stepExecutions) => {
    const outputs = {};
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
const handleStepError = async (instance, step, error, options) => {
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
                const currentExecution = instance.stepExecutions.find((s) => s.stepId === step.id);
                const retryCount = currentExecution?.retryCount || 0;
                if (retryCount < errorHandler.retryPolicy.maxAttempts) {
                    // Check if error is retryable
                    const retryableErrors = errorHandler.retryPolicy.retryableErrors || [];
                    if (retryableErrors.length === 0 || retryableErrors.includes(error.code)) {
                        // Wait before retry
                        const delay = calculateRetryDelay(retryCount, errorHandler.retryPolicy.initialDelaySeconds, errorHandler.retryPolicy.backoffType, errorHandler.retryPolicy.maxDelaySeconds);
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
const calculateRetryDelay = (retryCount, initialDelay, backoffType, maxDelay) => {
    let delay;
    if (backoffType === 'exponential') {
        delay = initialDelay * Math.pow(2, retryCount);
    }
    else {
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
const handleOrchestrationStep = async (instance, step, result, workflow) => {
    const output = result.output;
    switch (step.type) {
        case 'wait':
            // Wait steps require external event or timer
            return { waiting: true };
        case 'delay':
            // For delay steps, we could implement a simple sleep
            // In production, this would use Durable Functions timers
            const delaySeconds = output.delaySeconds;
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
const resumeWorkflow = async (instanceId, eventData, options = {}) => {
    const instance = await (0, instanceRepository_1.getInstance)(instanceId);
    if (instance.status !== 'waiting' && instance.status !== 'paused') {
        throw new Error(`Cannot resume instance with status ${instance.status}`);
    }
    // Update variables with event data if provided
    if (eventData) {
        await (0, instanceRepository_1.updateVariables)(instanceId, { eventData });
    }
    // Continue execution
    return (0, exports.executeWorkflow)(instanceId, options);
};
exports.resumeWorkflow = resumeWorkflow;
/**
 * Sleep utility
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
//# sourceMappingURL=workflowOrchestrator.js.map