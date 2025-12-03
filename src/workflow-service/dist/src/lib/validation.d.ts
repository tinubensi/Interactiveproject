import { WorkflowDefinition, WorkflowStep, CreateWorkflowRequest, UpdateWorkflowRequest, AddStepRequest } from '../models/workflowTypes';
export declare class ValidationError extends Error {
    errors: Array<{
        path: string;
        message: string;
    }>;
    constructor(message: string, errors: Array<{
        path: string;
        message: string;
    }>);
}
export declare const validateWorkflowDefinition: (workflow: Partial<WorkflowDefinition>) => WorkflowDefinition;
export declare const validateCreateWorkflowRequest: (request: unknown) => CreateWorkflowRequest;
export declare const validateUpdateWorkflowRequest: (request: unknown) => UpdateWorkflowRequest;
export declare const validateAddStepRequest: (request: unknown) => AddStepRequest;
export declare const validateWorkflowSteps: (steps: WorkflowStep[]) => {
    valid: boolean;
    errors: Array<{
        path: string;
        message: string;
    }>;
};
export declare const validateWorkflowIntegrity: (workflow: WorkflowDefinition) => {
    valid: boolean;
    errors: Array<{
        path: string;
        message: string;
    }>;
};
//# sourceMappingURL=validation.d.ts.map