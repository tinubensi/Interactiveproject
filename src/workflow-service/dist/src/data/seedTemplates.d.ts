import type { WorkflowTemplate } from '../models/workflowTypes';
type SeedTemplate = Omit<WorkflowTemplate, 'id' | 'createdAt'>;
export declare const INSURANCE_TEMPLATES: SeedTemplate[];
/**
 * Seed templates into the database
 * Run this once during initial setup
 */
export declare function seedTemplates(): Promise<void>;
export {};
//# sourceMappingURL=seedTemplates.d.ts.map