/**
 * Pipeline Repository
 * Data access layer for pipeline definitions
 */

import { v4 as uuidv4 } from 'uuid';
import { getPipelinesContainer } from '../lib/cosmosClient';
import type {
  PipelineDefinition,
  PipelineStep,
  CreatePipelineRequest,
  UpdatePipelineRequest,
  LineOfBusiness,
  PipelineStatus,
} from '../models/pipeline';

// =============================================================================
// Error Classes
// =============================================================================

export class PipelineNotFoundError extends Error {
  constructor(pipelineId: string) {
    super(`Pipeline not found: ${pipelineId}`);
    this.name = 'PipelineNotFoundError';
  }
}

export class DuplicatePipelineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicatePipelineError';
  }
}

// =============================================================================
// Create Operations
// =============================================================================

/**
 * Create a new pipeline definition
 */
export async function createPipeline(
  request: CreatePipelineRequest,
  createdBy: string
): Promise<PipelineDefinition> {
  const container = getPipelinesContainer();
  const now = new Date().toISOString();
  const pipelineId = uuidv4();

  // Generate step IDs if not provided
  const steps = (request.steps || []).map((step, index) => ({
    ...step,
    id: step.id || uuidv4(),
    order: step.order ?? index + 1,
    enabled: step.enabled ?? true,
  }));

  const pipeline: PipelineDefinition = {
    id: pipelineId,
    pipelineId,
    name: request.name,
    description: request.description,
    version: 1,
    lineOfBusiness: request.lineOfBusiness,
    businessType: request.businessType,
    organizationId: request.organizationId,
    status: 'draft',
    isDefault: request.isDefault,
    steps,
    entryStepId: steps.length > 0 ? steps[0].id : '',
    createdAt: now,
    createdBy,
  };

  const { resource } = await container.items.create(pipeline);
  return resource as PipelineDefinition;
}

// =============================================================================
// Read Operations
// =============================================================================

/**
 * Get a pipeline by ID
 */
export async function getPipeline(pipelineId: string): Promise<PipelineDefinition> {
  const container = getPipelinesContainer();

  // Query across all partitions
  const query = {
    query: 'SELECT * FROM c WHERE c.pipelineId = @pipelineId',
    parameters: [{ name: '@pipelineId', value: pipelineId }],
  };

  const { resources } = await container.items.query<PipelineDefinition>(query).fetchAll();

  if (resources.length === 0) {
    throw new PipelineNotFoundError(pipelineId);
  }

  return resources[0];
}

/**
 * Get a pipeline by ID and version
 */
export async function getPipelineByVersion(
  pipelineId: string,
  version: number
): Promise<PipelineDefinition> {
  const container = getPipelinesContainer();

  const query = {
    query: 'SELECT * FROM c WHERE c.pipelineId = @pipelineId AND c.version = @version',
    parameters: [
      { name: '@pipelineId', value: pipelineId },
      { name: '@version', value: version },
    ],
  };

  const { resources } = await container.items.query<PipelineDefinition>(query).fetchAll();

  if (resources.length === 0) {
    throw new PipelineNotFoundError(`${pipelineId} v${version}`);
  }

  return resources[0];
}

/**
 * List all pipelines with optional filters
 */
export async function listPipelines(filters?: {
  lineOfBusiness?: LineOfBusiness;
  status?: PipelineStatus;
  organizationId?: string;
}): Promise<PipelineDefinition[]> {
  const container = getPipelinesContainer();

  let query = 'SELECT * FROM c WHERE 1=1';
  const parameters: Array<{ name: string; value: string }> = [];

  if (filters?.lineOfBusiness) {
    query += ' AND c.lineOfBusiness = @lineOfBusiness';
    parameters.push({ name: '@lineOfBusiness', value: filters.lineOfBusiness });
  }

  if (filters?.status) {
    query += ' AND c.status = @status';
    parameters.push({ name: '@status', value: filters.status });
  }

  if (filters?.organizationId) {
    query += ' AND c.organizationId = @organizationId';
    parameters.push({ name: '@organizationId', value: filters.organizationId });
  }

  query += ' ORDER BY c.createdAt DESC';

  const { resources } = await container.items
    .query<PipelineDefinition>({ query, parameters })
    .fetchAll();

  return resources;
}

/**
 * Get the active pipeline for a specific LOB
 */
export async function getActivePipelineForLOB(
  lineOfBusiness: LineOfBusiness,
  businessType?: string,
  organizationId?: string
): Promise<PipelineDefinition | null> {
  const container = getPipelinesContainer();

  // First, try to find a specific pipeline for the LOB + business type + org
  let query = `
    SELECT * FROM c 
    WHERE c.lineOfBusiness = @lineOfBusiness 
    AND c.status = 'active'
  `;
  const parameters: Array<{ name: string; value: string }> = [
    { name: '@lineOfBusiness', value: lineOfBusiness },
  ];

  if (businessType) {
    query += ' AND (c.businessType = @businessType OR NOT IS_DEFINED(c.businessType))';
    parameters.push({ name: '@businessType', value: businessType });
  }

  if (organizationId) {
    query += ' AND (c.organizationId = @organizationId OR NOT IS_DEFINED(c.organizationId))';
    parameters.push({ name: '@organizationId', value: organizationId });
  }

  // Note: Removed ORDER BY to avoid composite index requirement
  // We'll sort in memory instead
  const { resources } = await container.items
    .query<PipelineDefinition>({ query, parameters })
    .fetchAll();

  // Sort in memory: prioritize non-default pipelines, then by activation date
  const sorted = resources.sort((a, b) => {
    // First, sort by isDefault (false/undefined first, then true)
    const aIsDefault = a.isDefault === true ? 1 : 0;
    const bIsDefault = b.isDefault === true ? 1 : 0;
    if (aIsDefault !== bIsDefault) {
      return aIsDefault - bIsDefault; // 0 (false) comes before 1 (true)
    }
    // Then sort by activatedAt (most recent first)
    const aDate = a.activatedAt ? new Date(a.activatedAt).getTime() : 0;
    const bDate = b.activatedAt ? new Date(b.activatedAt).getTime() : 0;
    return bDate - aDate; // Descending order
  });

  // Return the first matching pipeline (prioritizing non-default ones)
  if (sorted.length > 0) {
    return sorted[0];
  }

  // If no specific pipeline found, look for a default one
  const defaultQuery = {
    query: `
      SELECT * FROM c 
      WHERE c.lineOfBusiness = @lineOfBusiness 
      AND c.status = 'active' 
      AND c.isDefault = true
    `,
    parameters: [{ name: '@lineOfBusiness', value: lineOfBusiness }],
  };

  const { resources: defaultResources } = await container.items
    .query<PipelineDefinition>(defaultQuery)
    .fetchAll();

  return defaultResources.length > 0 ? defaultResources[0] : null;
}

// =============================================================================
// Update Operations
// =============================================================================

/**
 * Update a pipeline definition
 */
export async function updatePipeline(
  pipelineId: string,
  updates: UpdatePipelineRequest,
  updatedBy: string
): Promise<PipelineDefinition> {
  const pipeline = await getPipeline(pipelineId);
  const container = getPipelinesContainer();
  const now = new Date().toISOString();

  const updatedPipeline: PipelineDefinition = {
    ...pipeline,
    ...updates,
    updatedAt: now,
    updatedBy,
  };

  // If steps are updated, ensure they have IDs
  if (updates.steps) {
    updatedPipeline.steps = updates.steps.map((step, index) => ({
      ...step,
      id: step.id || uuidv4(),
      order: step.order ?? index + 1,
    }));
    // Update entry step if steps changed
    if (updatedPipeline.steps.length > 0) {
      const sortedSteps = [...updatedPipeline.steps].sort((a, b) => a.order - b.order);
      updatedPipeline.entryStepId = sortedSteps[0].id;
    }
  }

  const { resource } = await container
    .item(pipeline.id, pipeline.lineOfBusiness)
    .replace(updatedPipeline);

  return resource as PipelineDefinition;
}

/**
 * Activate a pipeline
 */
export async function activatePipeline(
  pipelineId: string,
  activatedBy: string
): Promise<PipelineDefinition> {
  const pipeline = await getPipeline(pipelineId);
  const container = getPipelinesContainer();
  const now = new Date().toISOString();

  // If this pipeline is marked as default, deactivate other defaults for the same LOB
  if (pipeline.isDefault) {
    await deactivateDefaultsForLOB(pipeline.lineOfBusiness, pipelineId);
  }

  const updatedPipeline: PipelineDefinition = {
    ...pipeline,
    status: 'active',
    activatedAt: now,
    activatedBy,
    updatedAt: now,
    updatedBy: activatedBy,
  };

  const { resource } = await container
    .item(pipeline.id, pipeline.lineOfBusiness)
    .replace(updatedPipeline);

  return resource as PipelineDefinition;
}

/**
 * Deactivate a pipeline
 */
export async function deactivatePipeline(
  pipelineId: string,
  deactivatedBy: string
): Promise<PipelineDefinition> {
  const pipeline = await getPipeline(pipelineId);
  const container = getPipelinesContainer();
  const now = new Date().toISOString();

  const updatedPipeline: PipelineDefinition = {
    ...pipeline,
    status: 'inactive',
    updatedAt: now,
    updatedBy: deactivatedBy,
  };

  const { resource } = await container
    .item(pipeline.id, pipeline.lineOfBusiness)
    .replace(updatedPipeline);

  return resource as PipelineDefinition;
}

/**
 * Helper to deactivate other default pipelines for a LOB
 */
async function deactivateDefaultsForLOB(
  lineOfBusiness: LineOfBusiness,
  excludePipelineId: string
): Promise<void> {
  const container = getPipelinesContainer();

  const query = {
    query: `
      SELECT * FROM c 
      WHERE c.lineOfBusiness = @lineOfBusiness 
      AND c.isDefault = true 
      AND c.status = 'active'
      AND c.pipelineId != @excludeId
    `,
    parameters: [
      { name: '@lineOfBusiness', value: lineOfBusiness },
      { name: '@excludeId', value: excludePipelineId },
    ],
  };

  const { resources } = await container.items.query<PipelineDefinition>(query).fetchAll();

  for (const pipeline of resources) {
    await container.item(pipeline.id, pipeline.lineOfBusiness).replace({
      ...pipeline,
      status: 'inactive',
      updatedAt: new Date().toISOString(),
    });
  }
}

// =============================================================================
// Delete Operations
// =============================================================================

/**
 * Delete a pipeline (soft delete by marking as deprecated)
 */
export async function deletePipeline(
  pipelineId: string,
  deletedBy: string
): Promise<void> {
  const pipeline = await getPipeline(pipelineId);
  const container = getPipelinesContainer();
  const now = new Date().toISOString();

  const updatedPipeline: PipelineDefinition = {
    ...pipeline,
    status: 'deprecated',
    updatedAt: now,
    updatedBy: deletedBy,
  };

  await container.item(pipeline.id, pipeline.lineOfBusiness).replace(updatedPipeline);
}

// =============================================================================
// Step Operations
// =============================================================================

/**
 * Add a step to a pipeline
 */
export async function addStep(
  pipelineId: string,
  step: Omit<PipelineStep, 'id'>,
  afterStepId: string | undefined,
  updatedBy: string
): Promise<PipelineDefinition> {
  const pipeline = await getPipeline(pipelineId);
  const newStep = { ...step, id: uuidv4() } as PipelineStep;

  let newSteps: PipelineStep[];

  if (afterStepId) {
    const afterIndex = pipeline.steps.findIndex(s => s.id === afterStepId);
    if (afterIndex === -1) {
      // Add at the end
      newSteps = [...pipeline.steps, newStep];
    } else {
      // Insert after the specified step
      newSteps = [
        ...pipeline.steps.slice(0, afterIndex + 1),
        newStep,
        ...pipeline.steps.slice(afterIndex + 1),
      ];
    }
  } else {
    // Add at the end
    newSteps = [...pipeline.steps, newStep];
  }

  // Reorder steps
  newSteps = newSteps.map((s, index) => ({ ...s, order: index + 1 }));

  return updatePipeline(pipelineId, { steps: newSteps }, updatedBy);
}

/**
 * Update a step in a pipeline
 */
export async function updateStep(
  pipelineId: string,
  stepId: string,
  updates: Partial<PipelineStep>,
  updatedBy: string
): Promise<PipelineDefinition> {
  const pipeline = await getPipeline(pipelineId);

  const stepIndex = pipeline.steps.findIndex(s => s.id === stepId);
  if (stepIndex === -1) {
    throw new Error(`Step not found: ${stepId}`);
  }

  const newSteps = [...pipeline.steps];
  newSteps[stepIndex] = { ...newSteps[stepIndex], ...updates, id: stepId } as PipelineStep;

  return updatePipeline(pipelineId, { steps: newSteps }, updatedBy);
}

/**
 * Delete a step from a pipeline
 */
export async function deleteStep(
  pipelineId: string,
  stepId: string,
  updatedBy: string
): Promise<PipelineDefinition> {
  const pipeline = await getPipeline(pipelineId);

  const newSteps = pipeline.steps
    .filter(s => s.id !== stepId)
    .map((s, index) => ({ ...s, order: index + 1 }));

  return updatePipeline(pipelineId, { steps: newSteps }, updatedBy);
}

/**
 * Reorder steps in a pipeline
 */
export async function reorderSteps(
  pipelineId: string,
  stepOrder: Array<{ stepId: string; order: number }>,
  updatedBy: string
): Promise<PipelineDefinition> {
  const pipeline = await getPipeline(pipelineId);

  const orderMap = new Map(stepOrder.map(so => [so.stepId, so.order]));

  const newSteps = pipeline.steps
    .map(step => ({
      ...step,
      order: orderMap.get(step.id) ?? step.order,
    }))
    .sort((a, b) => a.order - b.order);

  return updatePipeline(pipelineId, { steps: newSteps }, updatedBy);
}

