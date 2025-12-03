"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishApprovalRequired = exports.publishVariableUpdated = exports.publishInstanceFailed = exports.publishInstanceCompleted = exports.publishInstanceStarted = exports.publishStepFailed = exports.publishStepCompleted = exports.publishStepStarted = exports.publishToSignalR = void 0;
const service_bus_1 = require("@azure/service-bus");
const config_1 = require("./config");
// ----------------------------------------------------------------------------
// SignalR Publisher
// ----------------------------------------------------------------------------
let serviceBusSender = null;
async function getServiceBusSender() {
    if (serviceBusSender) {
        return serviceBusSender;
    }
    const config = (0, config_1.getConfig)();
    const connectionString = config.signalr?.serviceBusConnectionString;
    if (!connectionString) {
        console.warn('SignalR Service Bus connection string not configured');
        return null;
    }
    try {
        const client = new service_bus_1.ServiceBusClient(connectionString);
        serviceBusSender = client.createSender('workflow-events');
        return serviceBusSender;
    }
    catch (error) {
        console.error('Failed to create Service Bus sender:', error);
        return null;
    }
}
/**
 * Publish a message to SignalR via Service Bus
 */
async function publishToSignalR(message) {
    const sender = await getServiceBusSender();
    if (!sender) {
        // Silently skip if SignalR is not configured
        return;
    }
    try {
        await sender.sendMessages({
            body: message,
            contentType: 'application/json',
            sessionId: message.instanceId, // Group messages by instance
        });
    }
    catch (error) {
        console.error('Failed to publish SignalR message:', error);
        // Don't throw - SignalR failures shouldn't break workflow execution
    }
}
exports.publishToSignalR = publishToSignalR;
/**
 * Publish step started event
 */
async function publishStepStarted(instanceId, workflowId, organizationId, stepId, stepName, stepType) {
    await publishToSignalR({
        type: 'step.started',
        instanceId,
        workflowId,
        organizationId,
        timestamp: new Date().toISOString(),
        data: {
            stepId,
            stepName,
            stepType,
        },
    });
}
exports.publishStepStarted = publishStepStarted;
/**
 * Publish step completed event
 */
async function publishStepCompleted(instanceId, workflowId, organizationId, stepId, stepName, durationMs, output) {
    await publishToSignalR({
        type: 'step.completed',
        instanceId,
        workflowId,
        organizationId,
        timestamp: new Date().toISOString(),
        data: {
            stepId,
            stepName,
            durationMs,
            output,
        },
    });
}
exports.publishStepCompleted = publishStepCompleted;
/**
 * Publish step failed event
 */
async function publishStepFailed(instanceId, workflowId, organizationId, stepId, stepName, error, errorCode) {
    await publishToSignalR({
        type: 'step.failed',
        instanceId,
        workflowId,
        organizationId,
        timestamp: new Date().toISOString(),
        data: {
            stepId,
            stepName,
            error,
            errorCode,
        },
    });
}
exports.publishStepFailed = publishStepFailed;
/**
 * Publish instance started event
 */
async function publishInstanceStarted(instanceId, workflowId, organizationId, workflowName, triggerType) {
    await publishToSignalR({
        type: 'instance.started',
        instanceId,
        workflowId,
        organizationId,
        timestamp: new Date().toISOString(),
        data: {
            workflowName,
            triggerType,
        },
    });
}
exports.publishInstanceStarted = publishInstanceStarted;
/**
 * Publish instance completed event
 */
async function publishInstanceCompleted(instanceId, workflowId, organizationId, durationMs, finalVariables) {
    await publishToSignalR({
        type: 'instance.completed',
        instanceId,
        workflowId,
        organizationId,
        timestamp: new Date().toISOString(),
        data: {
            durationMs,
            finalVariables,
        },
    });
}
exports.publishInstanceCompleted = publishInstanceCompleted;
/**
 * Publish instance failed event
 */
async function publishInstanceFailed(instanceId, workflowId, organizationId, error, failedStepId) {
    await publishToSignalR({
        type: 'instance.failed',
        instanceId,
        workflowId,
        organizationId,
        timestamp: new Date().toISOString(),
        data: {
            error,
            failedStepId,
        },
    });
}
exports.publishInstanceFailed = publishInstanceFailed;
/**
 * Publish variable updated event
 */
async function publishVariableUpdated(instanceId, workflowId, organizationId, variableName, newValue) {
    await publishToSignalR({
        type: 'variable.updated',
        instanceId,
        workflowId,
        organizationId,
        timestamp: new Date().toISOString(),
        data: {
            variableName,
            newValue,
        },
    });
}
exports.publishVariableUpdated = publishVariableUpdated;
/**
 * Publish approval required event
 */
async function publishApprovalRequired(instanceId, workflowId, organizationId, approvalId, stepId, stepName) {
    await publishToSignalR({
        type: 'approval.required',
        instanceId,
        workflowId,
        organizationId,
        timestamp: new Date().toISOString(),
        data: {
            approvalId,
            stepId,
            stepName,
        },
    });
}
exports.publishApprovalRequired = publishApprovalRequired;
//# sourceMappingURL=signalrPublisher.js.map