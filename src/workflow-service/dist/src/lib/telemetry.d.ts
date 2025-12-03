import { WorkflowInstance, StepExecution, WorkflowDefinition } from '../models/workflowTypes';
/**
 * Telemetry interface for Application Insights integration
 * This provides a abstraction layer that can be implemented with
 * applicationinsights package or other telemetry providers
 */
export interface TelemetryClient {
    trackEvent(name: string, properties?: Record<string, string>): void;
    trackMetric(name: string, value: number, properties?: Record<string, string>): void;
    trackException(error: Error, properties?: Record<string, string>): void;
    trackDependency(name: string, data: string, duration: number, success: boolean, properties?: Record<string, string>): void;
    flush(): Promise<void>;
}
/**
 * Initialize telemetry with a custom client
 */
export declare const initializeTelemetry: (client: TelemetryClient) => void;
/**
 * Get the telemetry client
 */
export declare const getTelemetryClient: () => TelemetryClient;
/**
 * Alias for getTelemetryClient for convenience
 */
export declare const getTelemetry: () => TelemetryClient;
/**
 * Track workflow instance started
 */
export declare const trackWorkflowStarted: (instance: WorkflowInstance) => void;
/**
 * Track workflow instance completed
 */
export declare const trackWorkflowCompleted: (instance: WorkflowInstance, durationMs: number) => void;
/**
 * Track workflow instance failed
 */
export declare const trackWorkflowFailed: (instance: WorkflowInstance, error: Error) => void;
/**
 * Track step execution
 */
export declare const trackStepExecution: (instance: WorkflowInstance, stepExecution: StepExecution) => void;
/**
 * Track HTTP action execution
 */
export declare const trackHttpAction: (instance: WorkflowInstance, stepId: string, url: string, method: string, durationMs: number, statusCode: number, success: boolean) => void;
/**
 * Track Cosmos DB operation
 */
export declare const trackCosmosOperation: (operation: 'query' | 'upsert' | 'delete', container: string, durationMs: number, success: boolean, properties?: Record<string, string>) => void;
/**
 * Track Event Grid publish
 */
export declare const trackEventPublish: (eventType: string, durationMs: number, success: boolean, properties?: Record<string, string>) => void;
/**
 * Track approval request
 */
export declare const trackApprovalRequested: (instance: WorkflowInstance, stepId: string, approvalId: string) => void;
/**
 * Track approval decision
 */
export declare const trackApprovalDecision: (instance: WorkflowInstance, approvalId: string, decision: 'approved' | 'rejected', durationMs: number) => void;
/**
 * Track workflow definition activation
 */
export declare const trackWorkflowActivated: (workflow: WorkflowDefinition) => void;
/**
 * Custom metrics for dashboards
 */
export declare const trackCustomMetric: (name: string, value: number, properties?: Record<string, string>) => void;
//# sourceMappingURL=telemetry.d.ts.map