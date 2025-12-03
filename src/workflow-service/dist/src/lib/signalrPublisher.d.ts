export type SignalRMessageType = 'step.started' | 'step.completed' | 'step.failed' | 'instance.started' | 'instance.completed' | 'instance.failed' | 'instance.paused' | 'variable.updated' | 'approval.required';
export interface SignalRMessage {
    type: SignalRMessageType;
    instanceId: string;
    workflowId: string;
    organizationId: string;
    timestamp: string;
    data: Record<string, unknown>;
}
/**
 * Publish a message to SignalR via Service Bus
 */
export declare function publishToSignalR(message: SignalRMessage): Promise<void>;
/**
 * Publish step started event
 */
export declare function publishStepStarted(instanceId: string, workflowId: string, organizationId: string, stepId: string, stepName: string, stepType: string): Promise<void>;
/**
 * Publish step completed event
 */
export declare function publishStepCompleted(instanceId: string, workflowId: string, organizationId: string, stepId: string, stepName: string, durationMs: number, output?: unknown): Promise<void>;
/**
 * Publish step failed event
 */
export declare function publishStepFailed(instanceId: string, workflowId: string, organizationId: string, stepId: string, stepName: string, error: string, errorCode?: string): Promise<void>;
/**
 * Publish instance started event
 */
export declare function publishInstanceStarted(instanceId: string, workflowId: string, organizationId: string, workflowName: string, triggerType: string): Promise<void>;
/**
 * Publish instance completed event
 */
export declare function publishInstanceCompleted(instanceId: string, workflowId: string, organizationId: string, durationMs: number, finalVariables?: Record<string, unknown>): Promise<void>;
/**
 * Publish instance failed event
 */
export declare function publishInstanceFailed(instanceId: string, workflowId: string, organizationId: string, error: string, failedStepId?: string): Promise<void>;
/**
 * Publish variable updated event
 */
export declare function publishVariableUpdated(instanceId: string, workflowId: string, organizationId: string, variableName: string, newValue: unknown): Promise<void>;
/**
 * Publish approval required event
 */
export declare function publishApprovalRequired(instanceId: string, workflowId: string, organizationId: string, approvalId: string, stepId: string, stepName: string): Promise<void>;
//# sourceMappingURL=signalrPublisher.d.ts.map