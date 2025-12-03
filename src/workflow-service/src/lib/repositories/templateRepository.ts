import { v4 as uuidv4 } from 'uuid';
import { getCosmosContainers } from '../cosmosClient';
import {
  WorkflowTemplate,
  WorkflowDefinition,
  TemplateFilters,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  CreateFromTemplateRequest,
  WorkflowStep,
  TriggerDefinition,
} from '../../models/workflowTypes';

// ----------------------------------------------------------------------------
// Errors
// ----------------------------------------------------------------------------

export class TemplateNotFoundError extends Error {
  constructor(templateId: string) {
    super(`Template ${templateId} not found`);
    this.name = 'TemplateNotFoundError';
  }
}

export class TemplateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateValidationError';
  }
}

// ----------------------------------------------------------------------------
// Create Template
// ----------------------------------------------------------------------------

export const createTemplate = async (
  request: CreateTemplateRequest,
  userId: string
): Promise<WorkflowTemplate> => {
  const containers = await getCosmosContainers();
  const templateId = `tpl-${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();

  const template: WorkflowTemplate = {
    id: templateId,
    templateId,
    name: request.name,
    description: request.description,
    category: request.category,
    tags: request.tags || [],
    baseWorkflow: request.baseWorkflow,
    requiredVariables: request.requiredVariables || [],
    configurationSchema: request.configurationSchema,
    previewImage: request.previewImage,
    documentation: request.documentation,
    isPublic: request.isPublic ?? true,
    organizationId: request.organizationId,
    createdAt: now,
    createdBy: userId,
    version: 1,
  };

  const { resource } = await containers.workflowTemplates.items.create(template);
  return resource as WorkflowTemplate;
};

// ----------------------------------------------------------------------------
// Get Template
// ----------------------------------------------------------------------------

export const getTemplate = async (templateId: string): Promise<WorkflowTemplate> => {
  const containers = await getCosmosContainers();

  const query = {
    query: `
      SELECT * FROM c 
      WHERE c.templateId = @templateId
    `,
    parameters: [{ name: '@templateId', value: templateId }],
  };

  const { resources } = await containers.workflowTemplates.items
    .query<WorkflowTemplate>(query)
    .fetchAll();

  if (resources.length === 0) {
    throw new TemplateNotFoundError(templateId);
  }

  return resources[0];
};

// ----------------------------------------------------------------------------
// List Templates
// ----------------------------------------------------------------------------

export const listTemplates = async (
  filters?: TemplateFilters
): Promise<WorkflowTemplate[]> => {
  const containers = await getCosmosContainers();

  let query = `SELECT * FROM c WHERE 1=1`;
  const parameters: Array<{ name: string; value: string | string[] | boolean }> = [];

  // Public templates or organization-specific
  if (filters?.organizationId) {
    query += ` AND (c.isPublic = true OR c.organizationId = @organizationId)`;
    parameters.push({ name: '@organizationId', value: filters.organizationId });
  } else if (filters?.isPublic !== undefined) {
    query += ` AND c.isPublic = @isPublic`;
    parameters.push({ name: '@isPublic', value: filters.isPublic });
  }

  if (filters?.category) {
    query += ` AND c.category = @category`;
    parameters.push({ name: '@category', value: filters.category });
  }

  if (filters?.tags && filters.tags.length > 0) {
    query += ` AND ARRAY_LENGTH(SetIntersect(c.tags, @tags)) > 0`;
    parameters.push({ name: '@tags', value: filters.tags });
  }

  if (filters?.search) {
    query += ` AND (CONTAINS(LOWER(c.name), LOWER(@search)) OR CONTAINS(LOWER(c.description), LOWER(@search)))`;
    parameters.push({ name: '@search', value: filters.search });
  }

  query += ` ORDER BY c.createdAt DESC`;

  const { resources } = await containers.workflowTemplates.items
    .query<WorkflowTemplate>({ query, parameters })
    .fetchAll();

  return resources;
};

// ----------------------------------------------------------------------------
// Update Template
// ----------------------------------------------------------------------------

export const updateTemplate = async (
  templateId: string,
  updates: UpdateTemplateRequest,
  userId: string
): Promise<WorkflowTemplate> => {
  const containers = await getCosmosContainers();
  const current = await getTemplate(templateId);
  const now = new Date().toISOString();

  const updatedTemplate: WorkflowTemplate = {
    ...current,
    name: updates.name ?? current.name,
    description: updates.description ?? current.description,
    category: updates.category ?? current.category,
    tags: updates.tags ?? current.tags,
    baseWorkflow: updates.baseWorkflow
      ? {
          triggers: updates.baseWorkflow.triggers ?? current.baseWorkflow.triggers,
          steps: updates.baseWorkflow.steps ?? current.baseWorkflow.steps,
          variables: updates.baseWorkflow.variables ?? current.baseWorkflow.variables,
          settings: updates.baseWorkflow.settings ?? current.baseWorkflow.settings,
        }
      : current.baseWorkflow,
    requiredVariables: updates.requiredVariables ?? current.requiredVariables,
    configurationSchema: updates.configurationSchema ?? current.configurationSchema,
    previewImage: updates.previewImage ?? current.previewImage,
    documentation: updates.documentation ?? current.documentation,
    isPublic: updates.isPublic ?? current.isPublic,
    updatedAt: now,
    updatedBy: userId,
    version: current.version + 1,
  };

  const { resource } = await containers.workflowTemplates.items.upsert(updatedTemplate);
  return (resource ?? updatedTemplate) as WorkflowTemplate;
};

// ----------------------------------------------------------------------------
// Delete Template
// ----------------------------------------------------------------------------

export const deleteTemplate = async (templateId: string): Promise<void> => {
  const containers = await getCosmosContainers();
  
  // First verify it exists
  const template = await getTemplate(templateId);
  
  await containers.workflowTemplates.item(template.id, template.id).delete();
};

// ----------------------------------------------------------------------------
// Create Workflow from Template
// ----------------------------------------------------------------------------

export const createWorkflowFromTemplate = async (
  request: CreateFromTemplateRequest,
  userId: string
): Promise<WorkflowDefinition> => {
  const containers = await getCosmosContainers();
  const template = await getTemplate(request.templateId);
  const now = new Date().toISOString();

  const workflowId = `wf-${uuidv4().slice(0, 8)}`;

  // Generate new IDs for steps
  const stepIdMap = new Map<string, string>();
  const newSteps: WorkflowStep[] = template.baseWorkflow.steps.map((step) => {
    const newStepId = `step-${uuidv4().slice(0, 8)}`;
    stepIdMap.set(step.id, newStepId);
    return { ...step, id: newStepId };
  });

  // Update step references (transitions, conditions)
  for (const step of newSteps) {
    if (step.transitions) {
      step.transitions = step.transitions.map((t) => ({
        ...t,
        targetStepId: stepIdMap.get(t.targetStepId) || t.targetStepId,
      }));
    }
    if (step.conditions) {
      step.conditions = step.conditions.map((c) => ({
        ...c,
        targetStepId: stepIdMap.get(c.targetStepId) || c.targetStepId,
      }));
    }
    // Handle nested steps in parallel/loop configs
    if (step.parallelConfig?.branches) {
      step.parallelConfig.branches = step.parallelConfig.branches.map((branch) => ({
        ...branch,
        id: `branch-${uuidv4().slice(0, 8)}`,
        steps: branch.steps.map((s) => ({
          ...s,
          id: `step-${uuidv4().slice(0, 8)}`,
        })),
      }));
    }
    if (step.loopConfig?.steps) {
      step.loopConfig.steps = step.loopConfig.steps.map((s) => ({
        ...s,
        id: `step-${uuidv4().slice(0, 8)}`,
      }));
    }
  }

  // Generate new IDs for triggers
  const newTriggers: TriggerDefinition[] = template.baseWorkflow.triggers.map((trigger) => ({
    ...trigger,
    id: `trigger-${uuidv4().slice(0, 8)}`,
  }));

  // Apply configuration substitutions if provided
  let variables = { ...template.baseWorkflow.variables };
  let settings = template.baseWorkflow.settings ? { ...template.baseWorkflow.settings } : undefined;

  if (request.configuration && template.configurationSchema) {
    // Apply configuration values
    // This is a simple implementation - could be enhanced with JSONata or similar
    for (const [key, value] of Object.entries(request.configuration)) {
      // Store configuration in variables or settings as appropriate
      if (key in (template.baseWorkflow.variables || {})) {
        variables = {
          ...variables,
          [key]: {
            ...variables[key],
            defaultValue: value,
          },
        };
      }
    }
  }

  const workflow: WorkflowDefinition = {
    id: `${workflowId}-v1`,
    workflowId,
    name: request.name,
    description: request.description || `Created from template: ${template.name}`,
    version: 1,
    status: 'draft',
    organizationId: request.organizationId,
    triggers: newTriggers,
    steps: newSteps,
    variables,
    settings,
    tags: template.tags,
    category: template.category,
    createdAt: now,
    createdBy: userId,
  };

  const { resource } = await containers.workflowDefinitions.items.create(workflow);
  return resource as WorkflowDefinition;
};

