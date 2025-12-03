"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackCustomMetric = exports.trackWorkflowActivated = exports.trackApprovalDecision = exports.trackApprovalRequested = exports.trackEventPublish = exports.trackCosmosOperation = exports.trackHttpAction = exports.trackStepExecution = exports.trackWorkflowFailed = exports.trackWorkflowCompleted = exports.trackWorkflowStarted = exports.getTelemetry = exports.getTelemetryClient = exports.initializeTelemetry = void 0;
/**
 * Console-based telemetry client for development
 */
class ConsoleTelemetryClient {
    trackEvent(name, properties) {
        console.log(`[TELEMETRY:EVENT] ${name}`, properties);
    }
    trackMetric(name, value, properties) {
        console.log(`[TELEMETRY:METRIC] ${name}=${value}`, properties);
    }
    trackException(error, properties) {
        console.error(`[TELEMETRY:EXCEPTION] ${error.message}`, error, properties);
    }
    trackDependency(name, data, duration, success, properties) {
        console.log(`[TELEMETRY:DEPENDENCY] ${name} (${duration}ms, success=${success})`, { data, ...properties });
    }
    async flush() {
        // No-op for console client
    }
}
// Singleton telemetry client
let telemetryClient = new ConsoleTelemetryClient();
/**
 * Initialize telemetry with a custom client
 */
const initializeTelemetry = (client) => {
    telemetryClient = client;
};
exports.initializeTelemetry = initializeTelemetry;
/**
 * Get the telemetry client
 */
const getTelemetryClient = () => {
    return telemetryClient;
};
exports.getTelemetryClient = getTelemetryClient;
/**
 * Alias for getTelemetryClient for convenience
 */
exports.getTelemetry = exports.getTelemetryClient;
/**
 * Track workflow instance started
 */
const trackWorkflowStarted = (instance) => {
    telemetryClient.trackEvent('WorkflowStarted', {
        instanceId: instance.instanceId,
        workflowId: instance.workflowId,
        workflowName: instance.workflowName,
        organizationId: instance.organizationId,
        triggerType: instance.triggerType
    });
};
exports.trackWorkflowStarted = trackWorkflowStarted;
/**
 * Track workflow instance completed
 */
const trackWorkflowCompleted = (instance, durationMs) => {
    telemetryClient.trackEvent('WorkflowCompleted', {
        instanceId: instance.instanceId,
        workflowId: instance.workflowId,
        workflowName: instance.workflowName,
        organizationId: instance.organizationId,
        stepCount: instance.completedStepIds.length.toString()
    });
    telemetryClient.trackMetric('workflow.duration', durationMs, {
        workflowId: instance.workflowId,
        workflowName: instance.workflowName
    });
    telemetryClient.trackMetric('workflow.steps.count', instance.completedStepIds.length, {
        workflowId: instance.workflowId
    });
};
exports.trackWorkflowCompleted = trackWorkflowCompleted;
/**
 * Track workflow instance failed
 */
const trackWorkflowFailed = (instance, error) => {
    telemetryClient.trackEvent('WorkflowFailed', {
        instanceId: instance.instanceId,
        workflowId: instance.workflowId,
        workflowName: instance.workflowName,
        organizationId: instance.organizationId,
        errorMessage: error.message,
        failedStepId: instance.currentStepId || 'unknown'
    });
    telemetryClient.trackException(error, {
        instanceId: instance.instanceId,
        workflowId: instance.workflowId
    });
};
exports.trackWorkflowFailed = trackWorkflowFailed;
/**
 * Track step execution
 */
const trackStepExecution = (instance, stepExecution) => {
    const success = stepExecution.status === 'completed';
    telemetryClient.trackEvent('StepExecuted', {
        instanceId: instance.instanceId,
        workflowId: instance.workflowId,
        stepId: stepExecution.stepId,
        stepName: stepExecution.stepName,
        stepType: stepExecution.stepType,
        status: stepExecution.status
    });
    if (stepExecution.durationMs) {
        telemetryClient.trackMetric('step.duration', stepExecution.durationMs, {
            workflowId: instance.workflowId,
            stepId: stepExecution.stepId,
            stepType: stepExecution.stepType
        });
    }
    if (!success && stepExecution.error) {
        telemetryClient.trackException(new Error(stepExecution.error.message), {
            instanceId: instance.instanceId,
            stepId: stepExecution.stepId,
            errorCode: stepExecution.error.code
        });
    }
};
exports.trackStepExecution = trackStepExecution;
/**
 * Track HTTP action execution
 */
const trackHttpAction = (instance, stepId, url, method, durationMs, statusCode, success) => {
    telemetryClient.trackDependency('HTTP', `${method} ${url}`, durationMs, success, {
        instanceId: instance.instanceId,
        stepId,
        statusCode: statusCode.toString()
    });
};
exports.trackHttpAction = trackHttpAction;
/**
 * Track Cosmos DB operation
 */
const trackCosmosOperation = (operation, container, durationMs, success, properties) => {
    telemetryClient.trackDependency('CosmosDB', `${operation} ${container}`, durationMs, success, properties);
};
exports.trackCosmosOperation = trackCosmosOperation;
/**
 * Track Event Grid publish
 */
const trackEventPublish = (eventType, durationMs, success, properties) => {
    telemetryClient.trackDependency('EventGrid', `publish ${eventType}`, durationMs, success, properties);
};
exports.trackEventPublish = trackEventPublish;
/**
 * Track approval request
 */
const trackApprovalRequested = (instance, stepId, approvalId) => {
    telemetryClient.trackEvent('ApprovalRequested', {
        instanceId: instance.instanceId,
        workflowId: instance.workflowId,
        stepId,
        approvalId
    });
};
exports.trackApprovalRequested = trackApprovalRequested;
/**
 * Track approval decision
 */
const trackApprovalDecision = (instance, approvalId, decision, durationMs) => {
    telemetryClient.trackEvent('ApprovalDecision', {
        instanceId: instance.instanceId,
        workflowId: instance.workflowId,
        approvalId,
        decision
    });
    telemetryClient.trackMetric('approval.duration', durationMs, {
        workflowId: instance.workflowId,
        decision
    });
};
exports.trackApprovalDecision = trackApprovalDecision;
/**
 * Track workflow definition activation
 */
const trackWorkflowActivated = (workflow) => {
    telemetryClient.trackEvent('WorkflowActivated', {
        workflowId: workflow.workflowId,
        workflowName: workflow.name,
        version: workflow.version.toString(),
        organizationId: workflow.organizationId,
        stepCount: workflow.steps.length.toString(),
        triggerCount: workflow.triggers.length.toString()
    });
};
exports.trackWorkflowActivated = trackWorkflowActivated;
/**
 * Custom metrics for dashboards
 */
const trackCustomMetric = (name, value, properties) => {
    telemetryClient.trackMetric(name, value, properties);
};
exports.trackCustomMetric = trackCustomMetric;
//# sourceMappingURL=telemetry.js.map