"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.determineNextStep = exports.executeStep = void 0;
const expressionResolver_1 = require("../engine/expressionResolver");
const conditionEvaluator_1 = require("../engine/conditionEvaluator");
const httpExecutor_1 = require("./httpExecutor");
const eventPublishExecutor_1 = require("./eventPublishExecutor");
const cosmosExecutor_1 = require("./cosmosExecutor");
const transformExecutor_1 = require("./transformExecutor");
const scriptExecutor_1 = require("./scriptExecutor");
/**
 * Execute a single workflow step
 */
const executeStep = async (step, executionContext) => {
    // Check if step is enabled
    if (step.isEnabled === false) {
        return {
            success: true,
            output: { skipped: true, reason: 'Step is disabled' },
            shouldTerminate: false
        };
    }
    // Create expression context
    const exprContext = {
        variables: executionContext.variables,
        stepOutputs: executionContext.stepOutputs,
        input: executionContext.variables.input || {}
    };
    try {
        switch (step.type) {
            case 'action':
                return await executeActionStep(step, exprContext);
            case 'decision':
                return executeDecisionStep(step, exprContext);
            case 'wait':
                return executeWaitStep(step, exprContext);
            case 'transform':
                return await executeTransformStep(step, exprContext);
            case 'script':
                return await executeScriptStep(step, exprContext);
            case 'setVariable':
                return executeSetVariableStep(step, exprContext);
            case 'delay':
                return executeDelayStep(step);
            case 'terminate':
                return executeTerminateStep(step);
            case 'parallel':
            case 'loop':
            case 'subworkflow':
            case 'human':
            case 'retry':
            case 'compensate':
                // These require orchestrator-level handling
                return {
                    success: true,
                    output: { requiresOrchestration: true, stepType: step.type },
                    shouldTerminate: false
                };
            default:
                return {
                    success: false,
                    error: {
                        code: 'UNKNOWN_STEP_TYPE',
                        message: `Unknown step type: ${step.type}`
                    },
                    shouldTerminate: false
                };
        }
    }
    catch (error) {
        return {
            success: false,
            error: {
                code: 'STEP_EXECUTION_ERROR',
                message: error instanceof Error ? error.message : 'Step execution failed',
                details: error instanceof Error ? error.stack : undefined
            },
            shouldTerminate: false
        };
    }
};
exports.executeStep = executeStep;
/**
 * Execute an action step
 */
const executeActionStep = async (step, context) => {
    if (!step.action) {
        return {
            success: false,
            error: {
                code: 'MISSING_ACTION_CONFIG',
                message: 'Action step requires action configuration'
            },
            shouldTerminate: false
        };
    }
    const actionType = step.action.type;
    const config = step.action.config;
    switch (actionType) {
        case 'http_request':
            const httpResult = await (0, httpExecutor_1.executeHttpRequest)(config, context);
            const stepResult = (0, httpExecutor_1.httpResultToStepResult)(httpResult);
            if (step.action.outputVariable) {
                stepResult.variableUpdates = {
                    [step.action.outputVariable]: stepResult.output
                };
            }
            return stepResult;
        case 'publish_event':
            const eventResult = await (0, eventPublishExecutor_1.executeEventPublish)(config, context);
            return (0, eventPublishExecutor_1.eventPublishResultToStepResult)(eventResult);
        case 'cosmos_query':
            const queryResult = await (0, cosmosExecutor_1.executeCosmosQuery)(config, context);
            const queryStepResult = (0, cosmosExecutor_1.cosmosResultToStepResult)(queryResult);
            if (step.action.outputVariable) {
                queryStepResult.variableUpdates = {
                    [step.action.outputVariable]: queryStepResult.output
                };
            }
            return queryStepResult;
        case 'cosmos_upsert':
            const upsertResult = await (0, cosmosExecutor_1.executeCosmosUpsert)(config, context);
            return (0, cosmosExecutor_1.cosmosResultToStepResult)(upsertResult);
        case 'cosmos_delete':
            const deleteResult = await (0, cosmosExecutor_1.executeCosmosDelete)(config, context);
            return (0, cosmosExecutor_1.cosmosResultToStepResult)(deleteResult);
        case 'send_command':
            // TODO: Implement Service Bus command sending
            return {
                success: true,
                output: { message: 'Command sending not yet implemented' },
                shouldTerminate: false
            };
        case 'send_notification':
            // TODO: Implement notification sending
            return {
                success: true,
                output: { message: 'Notification sending not yet implemented' },
                shouldTerminate: false
            };
        case 'call_function':
            // TODO: Implement Azure Function calling
            return {
                success: true,
                output: { message: 'Function calling not yet implemented' },
                shouldTerminate: false
            };
        default:
            return {
                success: false,
                error: {
                    code: 'UNKNOWN_ACTION_TYPE',
                    message: `Unknown action type: ${actionType}`
                },
                shouldTerminate: false
            };
    }
};
/**
 * Execute a decision step
 */
const executeDecisionStep = (step, context) => {
    if (!step.conditions || step.conditions.length === 0) {
        return {
            success: false,
            error: {
                code: 'MISSING_CONDITIONS',
                message: 'Decision step requires conditions'
            },
            shouldTerminate: false
        };
    }
    const nextStepId = (0, conditionEvaluator_1.findMatchingTransition)(step.conditions, context);
    return {
        success: true,
        output: { matchedTransition: nextStepId },
        nextStepId: nextStepId || undefined,
        shouldTerminate: false
    };
};
/**
 * Execute a wait step (returns immediately, orchestrator handles waiting)
 */
const executeWaitStep = (step, context) => {
    if (!step.waitConfig) {
        return {
            success: false,
            error: {
                code: 'MISSING_WAIT_CONFIG',
                message: 'Wait step requires wait configuration'
            },
            shouldTerminate: false
        };
    }
    // Wait steps are handled by the orchestrator
    return {
        success: true,
        output: {
            waitType: step.waitConfig.type,
            requiresOrchestration: true
        },
        shouldTerminate: false
    };
};
/**
 * Execute a transform step
 */
const executeTransformStep = async (step, context) => {
    if (!step.transformConfig) {
        return {
            success: false,
            error: {
                code: 'MISSING_TRANSFORM_CONFIG',
                message: 'Transform step requires transform configuration'
            },
            shouldTerminate: false
        };
    }
    const result = await (0, transformExecutor_1.executeTransform)(step.transformConfig, context);
    return (0, transformExecutor_1.transformResultToStepResult)(result);
};
/**
 * Execute a script step
 */
const executeScriptStep = async (step, context) => {
    if (!step.scriptConfig) {
        return {
            success: false,
            error: {
                code: 'MISSING_SCRIPT_CONFIG',
                message: 'Script step requires script configuration'
            },
            shouldTerminate: false
        };
    }
    const result = await (0, scriptExecutor_1.executeScript)(step.scriptConfig, context);
    return (0, scriptExecutor_1.scriptResultToStepResult)(result, step.outputVariable);
};
/**
 * Execute a setVariable step
 */
const executeSetVariableStep = (step, context) => {
    if (!step.setVariables) {
        return {
            success: false,
            error: {
                code: 'MISSING_VARIABLES',
                message: 'SetVariable step requires setVariables configuration'
            },
            shouldTerminate: false
        };
    }
    // Resolve all variable values
    const resolvedVariables = (0, expressionResolver_1.resolveObject)(step.setVariables, context);
    return {
        success: true,
        output: resolvedVariables,
        variableUpdates: resolvedVariables,
        shouldTerminate: false
    };
};
/**
 * Execute a delay step (returns the delay duration for orchestrator)
 */
const executeDelayStep = (step) => {
    const delaySeconds = step.delaySeconds || 0;
    return {
        success: true,
        output: {
            delaySeconds,
            requiresOrchestration: true
        },
        shouldTerminate: false
    };
};
/**
 * Execute a terminate step
 */
const executeTerminateStep = (step) => {
    return {
        success: true,
        output: { terminated: true },
        shouldTerminate: true
    };
};
/**
 * Determine the next step to execute based on transitions
 */
const determineNextStep = (currentStep, steps, context, stepResult) => {
    // If step result specifies next step, use it
    if (stepResult.nextStepId) {
        return stepResult.nextStepId;
    }
    // If step has transitions, evaluate them
    if (currentStep.transitions && currentStep.transitions.length > 0) {
        return (0, conditionEvaluator_1.findMatchingTransition)(currentStep.transitions, context);
    }
    // Otherwise, find the next step by order
    const sortedSteps = [...steps].sort((a, b) => a.order - b.order);
    const currentIndex = sortedSteps.findIndex((s) => s.id === currentStep.id);
    if (currentIndex >= 0 && currentIndex < sortedSteps.length - 1) {
        return sortedSteps[currentIndex + 1].id;
    }
    // No next step (end of workflow)
    return null;
};
exports.determineNextStep = determineNextStep;
//# sourceMappingURL=stepExecutorDispatcher.js.map