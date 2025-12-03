import { WorkflowDefinition, WorkflowFilters, CreateWorkflowRequest, UpdateWorkflowRequest, AddStepRequest, ReorderStepsRequest, WorkflowStep } from '../../models/workflowTypes';
export declare class WorkflowNotFoundError extends Error {
    constructor(workflowId: string, version?: number);
}
export declare class StepNotFoundError extends Error {
    constructor(stepId: string);
}
export declare class WorkflowValidationError extends Error {
    constructor(message: string);
}
/**
 * Create a new workflow
 */
export declare const createWorkflow: (request: CreateWorkflowRequest, userId: string) => Promise<WorkflowDefinition>;
/**
 * Get the latest version of a workflow
 */
export declare const getWorkflow: (workflowId: string) => Promise<WorkflowDefinition>;
/**
 * Get a specific version of a workflow
 */
export declare const getWorkflowByVersion: (workflowId: string, version: number) => Promise<WorkflowDefinition>;
/**
 * Update a workflow - creates a new version
 */
export declare const updateWorkflow: (workflowId: string, updates: UpdateWorkflowRequest, userId: string) => Promise<WorkflowDefinition>;
/**
 * List workflows with filters
 */
export declare const listWorkflows: (filters?: WorkflowFilters) => Promise<WorkflowDefinition[]>;
/**
 * Activate a workflow
 */
export declare const activateWorkflow: (workflowId: string, userId: string, version?: number) => Promise<WorkflowDefinition>;
/**
 * Deactivate a workflow
 */
export declare const deactivateWorkflow: (workflowId: string, userId: string) => Promise<WorkflowDefinition>;
/**
 * Soft delete a workflow (all versions)
 */
export declare const deleteWorkflow: (workflowId: string, userId: string) => Promise<void>;
/**
 * Clone a workflow
 */
export declare const cloneWorkflow: (sourceWorkflowId: string, newName: string, userId: string) => Promise<WorkflowDefinition>;
/**
 * Get all versions of a workflow
 */
export declare const getWorkflowVersions: (workflowId: string) => Promise<WorkflowDefinition[]>;
/**
 * Add a step to a workflow
 */
export declare const addStep: (workflowId: string, request: AddStepRequest, userId: string) => Promise<WorkflowDefinition>;
/**
 * Update a step in a workflow
 */
export declare const updateStep: (workflowId: string, stepId: string, updates: Partial<Omit<WorkflowStep, 'id'>>, userId: string) => Promise<WorkflowDefinition>;
/**
 * Delete a step from a workflow
 */
export declare const deleteStep: (workflowId: string, stepId: string, userId: string) => Promise<WorkflowDefinition>;
/**
 * Reorder steps in a workflow
 */
export declare const reorderSteps: (workflowId: string, request: ReorderStepsRequest, userId: string) => Promise<WorkflowDefinition>;
//# sourceMappingURL=workflowRepository.d.ts.map