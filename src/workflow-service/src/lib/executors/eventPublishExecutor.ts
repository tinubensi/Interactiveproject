import { getConfig } from '../config';
import {
  PublishEventConfig,
  StepResult,
  ExecutionError
} from '../../models/workflowTypes';
import {
  ExpressionContext,
  resolveTemplate,
  resolveObject
} from '../engine/expressionResolver';

export interface EventPublishResult {
  success: boolean;
  eventId?: string;
  error?: ExecutionError;
}

/**
 * Execute an event publish action
 */
export const executeEventPublish = async (
  config: PublishEventConfig,
  context: ExpressionContext
): Promise<EventPublishResult> => {
  const appConfig = getConfig();

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
    const eventType = resolveTemplate(config.eventType, context);
    const subject = config.subject
      ? resolveTemplate(config.subject, context)
      : `/${eventType}`;
    const data = resolveObject(config.data, context);
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
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'EVENT_PUBLISH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to publish event'
      }
    };
  }
};

/**
 * Convert event publish result to step result
 */
export const eventPublishResultToStepResult = (
  result: EventPublishResult
): StepResult => {
  return {
    success: result.success,
    output: result.success ? { eventId: result.eventId } : undefined,
    error: result.error,
    shouldTerminate: false
  };
};

