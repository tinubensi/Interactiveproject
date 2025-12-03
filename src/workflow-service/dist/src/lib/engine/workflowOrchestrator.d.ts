import { InstanceStatus, StepResult, ExecutionError } from '../../models/workflowTypes';
export interface OrchestratorResult {
    instanceId: string;
    status: InstanceStatus;
    completedSteps: string[];
    currentStepId?: string;
    variables: Record<string, unknown>;
    error?: ExecutionError;
}
export interface OrchestratorOptions {
    maxSteps?: number;
    timeout?: number;
    onStepStart?: (stepId: string, stepName: string) => Promise<void>;
    onStepComplete?: (stepId: string, result: StepResult) => Promise<void>;
    onError?: (stepId: string, error: ExecutionError) => Promise<void>;
}
/**
 * Execute a workflow instance
 * This is the main orchestration function that runs the workflow
 */
export declare const executeWorkflow: (instanceId: string, options?: OrchestratorOptions) => Promise<OrchestratorResult>;
/**
 * Resume a waiting workflow instance
 */
export declare const resumeWorkflow: (instanceId: string, eventData?: Record<string, unknown>, options?: OrchestratorOptions) => Promise<OrchestratorResult>;
//# sourceMappingURL=workflowOrchestrator.d.ts.map