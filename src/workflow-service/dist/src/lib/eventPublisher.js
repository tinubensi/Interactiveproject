"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishCustomWorkflowEvent = exports.publishWorkflowApprovalCompletedEvent = exports.publishWorkflowApprovalRequiredEvent = exports.publishWorkflowStepCompletedEvent = exports.publishWorkflowInstanceFailedEvent = exports.publishWorkflowInstanceCompletedEvent = exports.publishWorkflowInstanceStartedEvent = void 0;
const config_1 = require("./config");
/**
 * Publish an event to Event Grid
 */
const publishEvent = async (eventType, subject, data) => {
    const config = (0, config_1.getConfig)();
    if (!config.eventGrid.topicEndpoint || !config.eventGrid.topicKey) {
        console.warn('Event Grid not configured, skipping event publication');
        return;
    }
    const event = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        eventType,
        subject,
        eventTime: new Date().toISOString(),
        data,
        dataVersion: '1.0'
    };
    try {
        await fetch(config.eventGrid.topicEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'aeg-sas-key': config.eventGrid.topicKey
            },
            body: JSON.stringify([event])
        });
    }
    catch (error) {
        console.error('Failed to publish event:', error);
    }
};
/**
 * Publish WorkflowInstanceStartedEvent
 */
const publishWorkflowInstanceStartedEvent = async (instance) => {
    const data = {
        instanceId: instance.instanceId,
        workflowId: instance.workflowId,
        workflowName: instance.workflowName,
        organizationId: instance.organizationId,
        triggerId: instance.triggerId,
        triggerType: instance.triggerType,
        correlationId: instance.correlationId
    };
    await publishEvent('WorkflowInstanceStartedEvent', `/workflows/${instance.workflowId}/instances/${instance.instanceId}`, data);
};
exports.publishWorkflowInstanceStartedEvent = publishWorkflowInstanceStartedEvent;
/**
 * Publish WorkflowInstanceCompletedEvent
 */
const publishWorkflowInstanceCompletedEvent = async (instance, durationMs) => {
    const data = {
        instanceId: instance.instanceId,
        workflowId: instance.workflowId,
        workflowName: instance.workflowName,
        organizationId: instance.organizationId,
        durationMs,
        finalVariables: instance.variables
    };
    await publishEvent('WorkflowInstanceCompletedEvent', `/workflows/${instance.workflowId}/instances/${instance.instanceId}`, data);
};
exports.publishWorkflowInstanceCompletedEvent = publishWorkflowInstanceCompletedEvent;
/**
 * Publish WorkflowInstanceFailedEvent
 */
const publishWorkflowInstanceFailedEvent = async (instance, failedStep, error) => {
    const data = {
        instanceId: instance.instanceId,
        workflowId: instance.workflowId,
        workflowName: instance.workflowName,
        organizationId: instance.organizationId,
        error,
        failedStepId: failedStep.stepId,
        failedStepName: failedStep.stepName
    };
    await publishEvent('WorkflowInstanceFailedEvent', `/workflows/${instance.workflowId}/instances/${instance.instanceId}`, data);
};
exports.publishWorkflowInstanceFailedEvent = publishWorkflowInstanceFailedEvent;
/**
 * Publish WorkflowStepCompletedEvent
 */
const publishWorkflowStepCompletedEvent = async (instance, stepExecution) => {
    const data = {
        instanceId: instance.instanceId,
        workflowId: instance.workflowId,
        stepId: stepExecution.stepId,
        stepName: stepExecution.stepName,
        stepType: stepExecution.stepType,
        durationMs: stepExecution.durationMs || 0,
        output: stepExecution.output
    };
    await publishEvent('WorkflowStepCompletedEvent', `/workflows/${instance.workflowId}/instances/${instance.instanceId}/steps/${stepExecution.stepId}`, data);
};
exports.publishWorkflowStepCompletedEvent = publishWorkflowStepCompletedEvent;
/**
 * Publish WorkflowApprovalRequiredEvent
 */
const publishWorkflowApprovalRequiredEvent = async (approvalId, instance, stepId, stepName, approverRoles, approverUsers, context, expiresAt) => {
    const data = {
        approvalId,
        instanceId: instance.instanceId,
        workflowId: instance.workflowId,
        workflowName: instance.workflowName,
        stepId,
        stepName,
        approverRoles,
        approverUsers,
        context: context || {},
        expiresAt
    };
    await publishEvent('WorkflowApprovalRequiredEvent', `/workflows/${instance.workflowId}/instances/${instance.instanceId}/approvals/${approvalId}`, data);
};
exports.publishWorkflowApprovalRequiredEvent = publishWorkflowApprovalRequiredEvent;
/**
 * Publish WorkflowApprovalCompletedEvent
 */
const publishWorkflowApprovalCompletedEvent = async (approvalId, instance, stepId, decision, decidedBy, comment) => {
    const data = {
        approvalId,
        instanceId: instance.instanceId,
        workflowId: instance.workflowId,
        stepId,
        decision,
        decidedBy,
        comment
    };
    await publishEvent('WorkflowApprovalCompletedEvent', `/workflows/${instance.workflowId}/instances/${instance.instanceId}/approvals/${approvalId}`, data);
};
exports.publishWorkflowApprovalCompletedEvent = publishWorkflowApprovalCompletedEvent;
/**
 * Publish a custom workflow event
 */
const publishCustomWorkflowEvent = async (eventType, instance, data) => {
    await publishEvent(eventType, `/workflows/${instance.workflowId}/instances/${instance.instanceId}`, {
        instanceId: instance.instanceId,
        workflowId: instance.workflowId,
        organizationId: instance.organizationId,
        ...data
    });
};
exports.publishCustomWorkflowEvent = publishCustomWorkflowEvent;
//# sourceMappingURL=eventPublisher.js.map