"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventPublishResultToStepResult = exports.executeEventPublish = void 0;
const config_1 = require("../config");
const expressionResolver_1 = require("../engine/expressionResolver");
/**
 * Execute an event publish action
 */
const executeEventPublish = async (config, context) => {
    const appConfig = (0, config_1.getConfig)();
    if (!appConfig.eventGrid.topicEndpoint || !appConfig.eventGrid.topicKey) {
        return {
            success: false,
            error: {
                code: 'EVENT_GRID_NOT_CONFIGURED',
                message: 'Event Grid is not configured'
            }
        };
    }
    try {
        // Resolve template values
        const eventType = (0, expressionResolver_1.resolveTemplate)(config.eventType, context);
        const subject = config.subject
            ? (0, expressionResolver_1.resolveTemplate)(config.subject, context)
            : `/${eventType}`;
        const data = (0, expressionResolver_1.resolveObject)(config.data, context);
        const dataVersion = config.dataVersion || '1.0';
        // Generate event ID
        const eventId = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const event = {
            id: eventId,
            eventType,
            subject,
            eventTime: new Date().toISOString(),
            dataVersion,
            data
        };
        const response = await fetch(appConfig.eventGrid.topicEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'aeg-sas-key': appConfig.eventGrid.topicKey
            },
            body: JSON.stringify([event])
        });
        if (!response.ok) {
            return {
                success: false,
                error: {
                    code: `EVENT_GRID_${response.status}`,
                    message: `Failed to publish event: ${response.statusText}`
                }
            };
        }
        return {
            success: true,
            eventId
        };
    }
    catch (error) {
        return {
            success: false,
            error: {
                code: 'EVENT_PUBLISH_ERROR',
                message: error instanceof Error ? error.message : 'Failed to publish event'
            }
        };
    }
};
exports.executeEventPublish = executeEventPublish;
/**
 * Convert event publish result to step result
 */
const eventPublishResultToStepResult = (result) => {
    return {
        success: result.success,
        output: result.success ? { eventId: result.eventId } : undefined,
        error: result.error,
        shouldTerminate: false
    };
};
exports.eventPublishResultToStepResult = eventPublishResultToStepResult;
//# sourceMappingURL=eventPublishExecutor.js.map