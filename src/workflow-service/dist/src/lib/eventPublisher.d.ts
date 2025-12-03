import { WorkflowInstance, StepExecution, ExecutionError } from '../models/workflowTypes';
/**
 * Publish WorkflowInstanceStartedEvent
 */
export declare const publishWorkflowInstanceStartedEvent: (instance: WorkflowInstance) => Promise<void>;
/**
 * Publish WorkflowInstanceCompletedEvent
 */
export declare const publishWorkflowInstanceCompletedEvent: (instance: WorkflowInstance, durationMs: number) => Promise<void>;
/**
 * Publish WorkflowInstanceFailedEvent
 */
export declare const publishWorkflowInstanceFailedEvent: (instance: WorkflowInstance, failedStep: StepExecution, error: ExecutionError) => Promise<void>;
/**
 * Publish WorkflowStepCompletedEvent
 */
export declare const publishWorkflowStepCompletedEvent: (instance: WorkflowInstance, stepExecution: StepExecution) => Promise<void>;
/**
 * Publish WorkflowApprovalRequiredEvent
 */
export declare const publishWorkflowApprovalRequiredEvent: (approvalId: string, instance: WorkflowInstance, stepId: string, stepName: string, approverRoles?: string[], approverUsers?: string[], context?: Record<string, unknown>, expiresAt?: string) => Promise<void>;
/**
 * Publish WorkflowApprovalCompletedEvent
 */
export declare const publishWorkflowApprovalCompletedEvent: (approvalId: string, instance: WorkflowInstance, stepId: string, decision: 'approved' | 'rejected', decidedBy: string, comment?: string) => Promise<void>;
/**
 * Publish a custom workflow event
 */
export declare const publishCustomWorkflowEvent: (eventType: string, instance: WorkflowInstance, data: Record<string, unknown>) => Promise<void>;
//# sourceMappingURL=eventPublisher.d.ts.map