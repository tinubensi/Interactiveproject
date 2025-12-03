import { WorkflowInstance, InstanceStatus, InstanceFilters, StepExecution, TriggerType } from '../../models/workflowTypes';
export declare class InstanceNotFoundError extends Error {
    constructor(instanceId: string);
}
export interface CreateInstanceParams {
    workflowId: string;
    workflowVersion: number;
    workflowName: string;
    organizationId: string;
    triggerId: string;
    triggerType: TriggerType;
    triggerData?: Record<string, unknown>;
    variables?: Record<string, unknown>;
    correlationId?: string;
    parentInstanceId?: string;
    initiatedBy?: string;
}
/**
 * Create a new workflow instance
 */
export declare const createInstance: (params: CreateInstanceParams) => Promise<WorkflowInstance>;
/**
 * Get a workflow instance by ID
 */
export declare const getInstance: (instanceId: string) => Promise<WorkflowInstance>;
/**
 * Update a workflow instance
 */
export declare const updateInstance: (instanceId: string, updates: Partial<WorkflowInstance>) => Promise<WorkflowInstance>;
/**
 * Update instance status
 */
export declare const updateInstanceStatus: (instanceId: string, status: InstanceStatus, additionalUpdates?: Partial<WorkflowInstance>) => Promise<WorkflowInstance>;
/**
 * Update the current step being executed
 */
export declare const updateCurrentStep: (instanceId: string, stepId: string, stepExecution: StepExecution) => Promise<WorkflowInstance>;
/**
 * Update workflow variables
 */
export declare const updateVariables: (instanceId: string, variableUpdates: Record<string, unknown>) => Promise<WorkflowInstance>;
/**
 * List workflow instances with filters
 */
export declare const listInstances: (filters?: InstanceFilters) => Promise<WorkflowInstance[]>;
/**
 * Get step execution logs for an instance
 */
export declare const getInstanceLogs: (instanceId: string) => Promise<StepExecution[]>;
/**
 * Cancel a running instance
 */
export declare const cancelInstance: (instanceId: string, userId: string, reason?: string) => Promise<WorkflowInstance>;
/**
 * Pause a running instance
 */
export declare const pauseInstance: (instanceId: string) => Promise<WorkflowInstance>;
/**
 * Resume a paused instance
 */
export declare const resumeInstance: (instanceId: string) => Promise<WorkflowInstance>;
/**
 * Get child instances of a parent instance
 */
export declare const getChildInstances: (parentInstanceId: string) => Promise<WorkflowInstance[]>;
/**
 * Get instance statistics for a workflow
 */
export declare const getInstanceStats: (workflowId: string, organizationId: string) => Promise<Record<InstanceStatus, number>>;
//# sourceMappingURL=instanceRepository.d.ts.map