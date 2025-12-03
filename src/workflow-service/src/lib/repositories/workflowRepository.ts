import { v4 as uuidv4 } from 'uuid';
import { getCosmosContainers } from '../cosmosClient';
import {
  WorkflowDefinition,
  WorkflowFilters,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  AddStepRequest,
  ReorderStepsRequest,
  WorkflowStep,
  TriggerDefinition
} from '../../models/workflowTypes';
import { validateWorkflowIntegrity } from '../validation';

export class WorkflowNotFoundError extends Error {
  constructor(workflowId: string, version?: number) {
    const message = version
      ? `Workflow ${workflowId} version ${version} not found`
      : `Workflow ${workflowId} not found`;
    super(message);
    this.name = 'WorkflowNotFoundError';
  }
}

export class StepNotFoundError extends Error {
  constructor(stepId: string) {
    super(`Step ${stepId} not found`);
    this.name = 'StepNotFoundError';
  }
}

export class WorkflowValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowValidationError';
  }
}

/**
 * Create a new workflow
 */
export const createWorkflow = async (
  request: CreateWorkflowRequest,
  userId: string
): Promise<WorkflowDefinition> => {
  const containers = await getCosmosContainers();
  const workflowId = `wf-${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();

  const workflow: WorkflowDefinition = {
    id: `${workflowId}-v1`,
    workflowId,
    name: request.name,
    description: request.description,
    version: 1,
    status: 'draft',
    organizationId: request.organizationId,
    triggers: request.triggers || [],
    steps: request.steps || [],
    variables: request.variables,
    settings: request.settings,
    tags: request.tags,
    category: request.category,
    createdAt: now,
    createdBy: userId
  };

  const { resource } = await containers.workflowDefinitions.items.create(workflow);
  return resource as WorkflowDefinition;
};

/**
 * Get the latest version of a workflow
 */
export const getWorkflow = async (
  workflowId: string
): Promise<WorkflowDefinition> => {
  const containers = await getCosmosContainers();

  const query = {
    query: `
      SELECT * FROM c 
      WHERE c.workflowId = @workflowId 
      AND (c.isDeleted = false OR NOT IS_DEFINED(c.isDeleted))
      ORDER BY c.version DESC
      OFFSET 0 LIMIT 1
    `,
    parameters: [{ name: '@workflowId', value: workflowId }]
  };

  const { resources } = await containers.workflowDefinitions.items
    .query<WorkflowDefinition>(query)
    .fetchAll();

  if (resources.length === 0) {
    throw new WorkflowNotFoundError(workflowId);
  }

  return resources[0];
};

/**
 * Get a specific version of a workflow
 */
export const getWorkflowByVersion = async (
  workflowId: string,
  version: number
): Promise<WorkflowDefinition> => {
  const containers = await getCosmosContainers();

  const query = {
    query: `
      SELECT * FROM c 
      WHERE c.workflowId = @workflowId 
      AND c.version = @version
      AND (c.isDeleted = false OR NOT IS_DEFINED(c.isDeleted))
    `,
    parameters: [
      { name: '@workflowId', value: workflowId },
      { name: '@version', value: version }
    ]
  };

  const { resources } = await containers.workflowDefinitions.items
    .query<WorkflowDefinition>(query)
    .fetchAll();

  if (resources.length === 0) {
    throw new WorkflowNotFoundError(workflowId, version);
  }

  return resources[0];
};

/**
 * Update a workflow - creates a new version
 */
export const updateWorkflow = async (
  workflowId: string,
  updates: UpdateWorkflowRequest,
  userId: string
): Promise<WorkflowDefinition> => {
  const containers = await getCosmosContainers();
  const current = await getWorkflow(workflowId);
  const now = new Date().toISOString();

  const newVersion = current.version + 1;
  const newWorkflow: WorkflowDefinition = {
    ...current,
    id: `${workflowId}-v${newVersion}`,
    version: newVersion,
    status: 'draft', // New version always starts as draft
    name: updates.name ?? current.name,
    description: updates.description ?? current.description,
    triggers: updates.triggers ?? current.triggers,
    steps: updates.steps ?? current.steps,
    variables: updates.variables ?? current.variables,
    settings: updates.settings ?? current.settings,
    tags: updates.tags ?? current.tags,
    category: updates.category ?? current.category,
    updatedAt: now,
    updatedBy: userId,
    activatedAt: undefined,
    activatedBy: undefined
  };

  const { resource } = await containers.workflowDefinitions.items.create(newWorkflow);
  return resource as WorkflowDefinition;
};

/**
 * List workflows with filters
 */
export const listWorkflows = async (
  filters?: WorkflowFilters
): Promise<WorkflowDefinition[]> => {
  const containers = await getCosmosContainers();

  let query = `
    SELECT * FROM c 
    WHERE (c.isDeleted = false OR NOT IS_DEFINED(c.isDeleted))
  `;
  const parameters: Array<{ name: string; value: string | string[] }> = [];

  if (filters?.organizationId) {
    query += ' AND c.organizationId = @organizationId';
    parameters.push({ name: '@organizationId', value: filters.organizationId });
  }

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query += ` AND c.status IN (${filters.status.map((_, i) => `@status${i}`).join(',')})`;
      filters.status.forEach((s, i) => {
        parameters.push({ name: `@status${i}`, value: s });
      });
    } else {
      query += ' AND c.status = @status';
      parameters.push({ name: '@status', value: filters.status });
    }
  }

  if (filters?.category) {
    query += ' AND c.category = @category';
    parameters.push({ name: '@category', value: filters.category });
  }

  if (filters?.tags && filters.tags.length > 0) {
    query += ' AND ARRAY_LENGTH(SetIntersect(c.tags, @tags)) > 0';
    parameters.push({ name: '@tags', value: filters.tags });
  }

  if (filters?.search) {
    query += ' AND (CONTAINS(LOWER(c.name), LOWER(@search)) OR CONTAINS(LOWER(c.description), LOWER(@search)))';
    parameters.push({ name: '@search', value: filters.search });
  }

  query += ' ORDER BY c.createdAt DESC';

  const { resources } = await containers.workflowDefinitions.items
    .query<WorkflowDefinition>({ query, parameters })
    .fetchAll();

  // Get only the latest version of each workflow
  const latestVersions = new Map<string, WorkflowDefinition>();
  for (const wf of resources) {
    const existing = latestVersions.get(wf.workflowId);
    if (!existing || wf.version > existing.version) {
      latestVersions.set(wf.workflowId, wf);
    }
  }

  return Array.from(latestVersions.values());
};

/**
 * Activate a workflow
 */
export const activateWorkflow = async (
  workflowId: string,
  userId: string,
  version?: number
): Promise<WorkflowDefinition> => {
  const containers = await getCosmosContainers();
  const workflow = version
    ? await getWorkflowByVersion(workflowId, version)
    : await getWorkflow(workflowId);

  // Validate workflow before activation
  if (!workflow.steps || workflow.steps.length === 0) {
    throw new WorkflowValidationError(
      'Cannot activate workflow without steps'
    );
  }

  const validation = validateWorkflowIntegrity(workflow);
  if (!validation.valid) {
    throw new WorkflowValidationError(
      `Workflow validation failed: ${validation.errors.map((e) => e.message).join(', ')}`
    );
  }

  const now = new Date().toISOString();

  // Deactivate any currently active version
  const activeQuery = {
    query: `
      SELECT * FROM c 
      WHERE c.workflowId = @workflowId 
      AND c.status = 'active'
    `,
    parameters: [{ name: '@workflowId', value: workflowId }]
  };

  const { resources: activeVersions } = await containers.workflowDefinitions.items
    .query<WorkflowDefinition>(activeQuery)
    .fetchAll();

  for (const activeVersion of activeVersions) {
    await containers.workflowDefinitions.items.upsert({
      ...activeVersion,
      status: 'inactive',
      updatedAt: now,
      updatedBy: userId
    });
  }

  // Activate the target version
  const activatedWorkflow: WorkflowDefinition = {
    ...workflow,
    status: 'active',
    activatedAt: now,
    activatedBy: userId,
    updatedAt: now,
    updatedBy: userId
  };

  await containers.workflowDefinitions.items.upsert(activatedWorkflow);
  return activatedWorkflow;
};

/**
 * Deactivate a workflow
 */
export const deactivateWorkflow = async (
  workflowId: string,
  userId: string
): Promise<WorkflowDefinition> => {
  const containers = await getCosmosContainers();
  const now = new Date().toISOString();

  // Find the active version
  const query = {
    query: `
      SELECT * FROM c 
      WHERE c.workflowId = @workflowId 
      AND c.status = 'active'
    `,
    parameters: [{ name: '@workflowId', value: workflowId }]
  };

  const { resources } = await containers.workflowDefinitions.items
    .query<WorkflowDefinition>(query)
    .fetchAll();

  if (resources.length === 0) {
    throw new WorkflowNotFoundError(workflowId);
  }

  const workflow = resources[0];
  const deactivatedWorkflow: WorkflowDefinition = {
    ...workflow,
    status: 'inactive',
    updatedAt: now,
    updatedBy: userId
  };

  await containers.workflowDefinitions.items.upsert(deactivatedWorkflow);
  return deactivatedWorkflow;
};

/**
 * Soft delete a workflow (all versions)
 */
export const deleteWorkflow = async (
  workflowId: string,
  userId: string
): Promise<void> => {
  const containers = await getCosmosContainers();
  const now = new Date().toISOString();

  // Get all versions
  const query = {
    query: `
      SELECT * FROM c 
      WHERE c.workflowId = @workflowId
    `,
    parameters: [{ name: '@workflowId', value: workflowId }]
  };

  const { resources } = await containers.workflowDefinitions.items
    .query<WorkflowDefinition>(query)
    .fetchAll();

  if (resources.length === 0) {
    throw new WorkflowNotFoundError(workflowId);
  }

  // Soft delete all versions
  for (const workflow of resources) {
    await containers.workflowDefinitions.items.upsert({
      ...workflow,
      isDeleted: true,
      deletedAt: now,
      deletedBy: userId,
      status: 'deprecated'
    });
  }
};

/**
 * Clone a workflow
 */
export const cloneWorkflow = async (
  sourceWorkflowId: string,
  newName: string,
  userId: string
): Promise<WorkflowDefinition> => {
  const containers = await getCosmosContainers();
  const source = await getWorkflow(sourceWorkflowId);
  const now = new Date().toISOString();

  const newWorkflowId = `wf-${uuidv4().slice(0, 8)}`;

  // Clone steps with new IDs
  const stepIdMap = new Map<string, string>();
  const clonedSteps: WorkflowStep[] = source.steps.map((step) => {
    const newStepId = `step-${uuidv4().slice(0, 8)}`;
    stepIdMap.set(step.id, newStepId);
    return { ...step, id: newStepId };
  });

  // Update transition references
  for (const step of clonedSteps) {
    if (step.transitions) {
      step.transitions = step.transitions.map((t) => ({
        ...t,
        targetStepId: stepIdMap.get(t.targetStepId) || t.targetStepId
      }));
    }
    if (step.conditions) {
      step.conditions = step.conditions.map((c) => ({
        ...c,
        targetStepId: stepIdMap.get(c.targetStepId) || c.targetStepId
      }));
    }
  }

  // Clone triggers with new IDs
  const clonedTriggers: TriggerDefinition[] = source.triggers.map((trigger) => ({
    ...trigger,
    id: `trigger-${uuidv4().slice(0, 8)}`
  }));

  const clonedWorkflow: WorkflowDefinition = {
    id: `${newWorkflowId}-v1`,
    workflowId: newWorkflowId,
    name: newName,
    description: source.description
      ? `Cloned from ${source.name}: ${source.description}`
      : `Cloned from ${source.name}`,
    version: 1,
    status: 'draft',
    organizationId: source.organizationId,
    triggers: clonedTriggers,
    steps: clonedSteps,
    variables: source.variables,
    settings: source.settings,
    tags: source.tags,
    category: source.category,
    createdAt: now,
    createdBy: userId
  };

  const { resource } = await containers.workflowDefinitions.items.create(
    clonedWorkflow
  );
  return resource as WorkflowDefinition;
};

/**
 * Get all versions of a workflow
 */
export const getWorkflowVersions = async (
  workflowId: string
): Promise<WorkflowDefinition[]> => {
  const containers = await getCosmosContainers();

  const query = {
    query: `
      SELECT * FROM c 
      WHERE c.workflowId = @workflowId 
      AND (c.isDeleted = false OR NOT IS_DEFINED(c.isDeleted))
      ORDER BY c.version DESC
    `,
    parameters: [{ name: '@workflowId', value: workflowId }]
  };

  const { resources } = await containers.workflowDefinitions.items
    .query<WorkflowDefinition>(query)
    .fetchAll();

  if (resources.length === 0) {
    throw new WorkflowNotFoundError(workflowId);
  }

  return resources;
};

/**
 * Add a step to a workflow
 */
export const addStep = async (
  workflowId: string,
  request: AddStepRequest,
  userId: string
): Promise<WorkflowDefinition> => {
  const current = await getWorkflow(workflowId);

  const newStepId = `step-${uuidv4().slice(0, 8)}`;
  const newStep: WorkflowStep = {
    ...request.step,
    id: newStepId
  } as WorkflowStep;

  let steps = [...current.steps];

  if (request.afterStepId) {
    // Insert after the specified step
    const afterIndex = steps.findIndex((s) => s.id === request.afterStepId);
    if (afterIndex === -1) {
      throw new StepNotFoundError(request.afterStepId);
    }

    // Insert at the right position
    steps.splice(afterIndex + 1, 0, newStep);

    // Recalculate order values
    steps = steps.map((step, index) => ({
      ...step,
      order: index + 1
    }));
  } else {
    // Add at the end or at the specified order
    if (newStep.order === undefined) {
      newStep.order = steps.length + 1;
    }
    steps.push(newStep);
    steps.sort((a, b) => a.order - b.order);
  }

  return updateWorkflow(workflowId, { steps }, userId);
};

/**
 * Update a step in a workflow
 */
export const updateStep = async (
  workflowId: string,
  stepId: string,
  updates: Partial<Omit<WorkflowStep, 'id'>>,
  userId: string
): Promise<WorkflowDefinition> => {
  const current = await getWorkflow(workflowId);

  const stepIndex = current.steps.findIndex((s) => s.id === stepId);
  if (stepIndex === -1) {
    throw new StepNotFoundError(stepId);
  }

  const updatedSteps = [...current.steps];
  updatedSteps[stepIndex] = {
    ...updatedSteps[stepIndex],
    ...updates
  };

  return updateWorkflow(workflowId, { steps: updatedSteps }, userId);
};

/**
 * Delete a step from a workflow
 */
export const deleteStep = async (
  workflowId: string,
  stepId: string,
  userId: string
): Promise<WorkflowDefinition> => {
  const current = await getWorkflow(workflowId);

  const stepIndex = current.steps.findIndex((s) => s.id === stepId);
  if (stepIndex === -1) {
    throw new StepNotFoundError(stepId);
  }

  const updatedSteps = current.steps
    .filter((s) => s.id !== stepId)
    .map((step, index) => ({
      ...step,
      order: index + 1
    }));

  // Remove references to the deleted step in transitions
  for (const step of updatedSteps) {
    if (step.transitions) {
      step.transitions = step.transitions.filter(
        (t) => t.targetStepId !== stepId
      );
    }
    if (step.conditions) {
      step.conditions = step.conditions.filter(
        (c) => c.targetStepId !== stepId
      );
    }
  }

  return updateWorkflow(workflowId, { steps: updatedSteps }, userId);
};

/**
 * Reorder steps in a workflow
 */
export const reorderSteps = async (
  workflowId: string,
  request: ReorderStepsRequest,
  userId: string
): Promise<WorkflowDefinition> => {
  const current = await getWorkflow(workflowId);

  const orderMap = new Map(
    request.stepOrder.map((o) => [o.stepId, o.order])
  );

  const updatedSteps = current.steps.map((step) => {
    const newOrder = orderMap.get(step.id);
    if (newOrder !== undefined) {
      return { ...step, order: newOrder };
    }
    return step;
  });

  updatedSteps.sort((a, b) => a.order - b.order);

  return updateWorkflow(workflowId, { steps: updatedSteps }, userId);
};

