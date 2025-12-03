import { WorkflowTemplate, WorkflowDefinition, TemplateFilters, CreateTemplateRequest, UpdateTemplateRequest, CreateFromTemplateRequest } from '../../models/workflowTypes';
export declare class TemplateNotFoundError extends Error {
    constructor(templateId: string);
}
export declare class TemplateValidationError extends Error {
    constructor(message: string);
}
export declare const createTemplate: (request: CreateTemplateRequest, userId: string) => Promise<WorkflowTemplate>;
export declare const getTemplate: (templateId: string) => Promise<WorkflowTemplate>;
export declare const listTemplates: (filters?: TemplateFilters) => Promise<WorkflowTemplate[]>;
export declare const updateTemplate: (templateId: string, updates: UpdateTemplateRequest, userId: string) => Promise<WorkflowTemplate>;
export declare const deleteTemplate: (templateId: string) => Promise<void>;
export declare const createWorkflowFromTemplate: (request: CreateFromTemplateRequest, userId: string) => Promise<WorkflowDefinition>;
//# sourceMappingURL=templateRepository.d.ts.map