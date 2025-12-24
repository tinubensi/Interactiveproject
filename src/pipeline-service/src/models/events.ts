/**
 * Event Data Models for Pipeline Service
 * Action events (Pipeline → Services) and Completion events (Services → Pipeline)
 */

/**
 * Action events (Pipeline → Services)
 */
export interface PipelineActionEvent {
  eventType: string;
  data: {
    instanceId: string;
    leadId: string;
    lineOfBusiness: string;
    businessType?: string;
    currentStage: string;
    actionData: Record<string, any>;
    metadata: {
      correlationId: string;
      pipelineId: string;
      timestamp: string;
    };
  };
}

/**
 * Completion events (Services → Pipeline)
 * Note: metadata is part of the data object, not a separate top-level property
 */
export interface ServiceCompletionEvent {
  eventType: string;
  data: {
    instanceId: string;
    leadId: string;
    actionCompleted: string;
    status: 'success' | 'failure' | 'partial';
    result: Record<string, any>;
    error?: {
      code: string;
      message: string;
      retryable: boolean;
    };
    metadata?: {
      correlationId: string;
      timestamp: string;
      serviceName: string;
    };
  };
}

