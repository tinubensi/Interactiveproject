import { v4 as uuidv4 } from 'uuid';
import { getCosmosContainers } from '../cosmosClient';
import { CanvasState, SaveCanvasRequest } from '../../models/workflowTypes';

// ----------------------------------------------------------------------------
// Errors
// ----------------------------------------------------------------------------

export class CanvasNotFoundError extends Error {
  constructor(workflowId: string) {
    super(`Canvas state for workflow ${workflowId} not found`);
    this.name = 'CanvasNotFoundError';
  }
}

// ----------------------------------------------------------------------------
// Get Canvas
// ----------------------------------------------------------------------------

export const getCanvas = async (workflowId: string): Promise<CanvasState | null> => {
  const containers = await getCosmosContainers();

  const query = {
    query: `
      SELECT * FROM c 
      WHERE c.workflowId = @workflowId
    `,
    parameters: [{ name: '@workflowId', value: workflowId }],
  };

  const { resources } = await containers.workflowCanvas.items
    .query<CanvasState>(query)
    .fetchAll();

  if (resources.length === 0) {
    return null;
  }

  return resources[0];
};

// ----------------------------------------------------------------------------
// Save Canvas
// ----------------------------------------------------------------------------

export const saveCanvas = async (
  workflowId: string,
  request: SaveCanvasRequest,
  userId: string
): Promise<CanvasState> => {
  const containers = await getCosmosContainers();
  const now = new Date().toISOString();

  // Get existing canvas or create new
  const existing = await getCanvas(workflowId);

  const canvasState: CanvasState = {
    id: existing?.id || `canvas-${uuidv4().slice(0, 8)}`,
    workflowId,
    version: (existing?.version || 0) + 1,
    nodePositions: request.nodePositions,
    viewport: request.viewport,
    updatedAt: now,
    updatedBy: userId,
  };

  const { resource } = await containers.workflowCanvas.items.upsert(canvasState);
  return (resource ?? canvasState) as CanvasState;
};

// ----------------------------------------------------------------------------
// Delete Canvas
// ----------------------------------------------------------------------------

export const deleteCanvas = async (workflowId: string): Promise<void> => {
  const containers = await getCosmosContainers();
  const existing = await getCanvas(workflowId);

  if (existing) {
    await containers.workflowCanvas.item(existing.id, workflowId).delete();
  }
};

