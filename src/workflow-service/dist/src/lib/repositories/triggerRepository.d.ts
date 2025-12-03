import { WorkflowTrigger, TriggerDefinition } from '../../models/workflowTypes';
export declare class TriggerNotFoundError extends Error {
    constructor(triggerId: string);
}
/**
 * Register a workflow trigger
 */
export declare const registerTrigger: (workflowId: string, workflowVersion: number, organizationId: string, trigger: TriggerDefinition) => Promise<WorkflowTrigger>;
/**
 * Unregister a trigger
 */
export declare const unregisterTrigger: (triggerId: string) => Promise<void>;
/**
 * Get a trigger by ID
 */
export declare const getTrigger: (triggerId: string) => Promise<WorkflowTrigger>;
/**
 * Find all triggers for a specific event type
 */
export declare const findTriggersForEvent: (eventType: string) => Promise<WorkflowTrigger[]>;
/**
 * Find all triggers for a workflow
 */
export declare const findTriggersForWorkflow: (workflowId: string) => Promise<WorkflowTrigger[]>;
/**
 * Activate a trigger
 */
export declare const activateTrigger: (triggerId: string) => Promise<WorkflowTrigger>;
/**
 * Deactivate a trigger
 */
export declare const deactivateTrigger: (triggerId: string) => Promise<WorkflowTrigger>;
/**
 * Update trigger priority
 */
export declare const updateTriggerPriority: (triggerId: string, priority: number) => Promise<WorkflowTrigger>;
/**
 * Deactivate all triggers for a workflow
 */
export declare const deactivateWorkflowTriggers: (workflowId: string) => Promise<void>;
/**
 * Delete all triggers for a workflow
 */
export declare const deleteWorkflowTriggers: (workflowId: string) => Promise<void>;
/**
 * Register triggers for an activated workflow
 */
export declare const registerWorkflowTriggers: (workflowId: string, workflowVersion: number, organizationId: string, triggers: TriggerDefinition[]) => Promise<WorkflowTrigger[]>;
//# sourceMappingURL=triggerRepository.d.ts.map