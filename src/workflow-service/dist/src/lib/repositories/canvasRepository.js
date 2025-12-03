"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCanvas = exports.saveCanvas = exports.getCanvas = exports.CanvasNotFoundError = void 0;
const uuid_1 = require("uuid");
const cosmosClient_1 = require("../cosmosClient");
// ----------------------------------------------------------------------------
// Errors
// ----------------------------------------------------------------------------
class CanvasNotFoundError extends Error {
    constructor(workflowId) {
        super(`Canvas state for workflow ${workflowId} not found`);
        this.name = 'CanvasNotFoundError';
    }
}
exports.CanvasNotFoundError = CanvasNotFoundError;
// ----------------------------------------------------------------------------
// Get Canvas
// ----------------------------------------------------------------------------
const getCanvas = async (workflowId) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const query = {
        query: `
      SELECT * FROM c 
      WHERE c.workflowId = @workflowId
    `,
        parameters: [{ name: '@workflowId', value: workflowId }],
    };
    const { resources } = await containers.workflowCanvas.items
        .query(query)
        .fetchAll();
    if (resources.length === 0) {
        return null;
    }
    return resources[0];
};
exports.getCanvas = getCanvas;
// ----------------------------------------------------------------------------
// Save Canvas
// ----------------------------------------------------------------------------
const saveCanvas = async (workflowId, request, userId) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const now = new Date().toISOString();
    // Get existing canvas or create new
    const existing = await (0, exports.getCanvas)(workflowId);
    const canvasState = {
        id: existing?.id || `canvas-${(0, uuid_1.v4)().slice(0, 8)}`,
        workflowId,
        version: (existing?.version || 0) + 1,
        nodePositions: request.nodePositions,
        viewport: request.viewport,
        updatedAt: now,
        updatedBy: userId,
    };
    const { resource } = await containers.workflowCanvas.items.upsert(canvasState);
    return (resource ?? canvasState);
};
exports.saveCanvas = saveCanvas;
// ----------------------------------------------------------------------------
// Delete Canvas
// ----------------------------------------------------------------------------
const deleteCanvas = async (workflowId) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const existing = await (0, exports.getCanvas)(workflowId);
    if (existing) {
        await containers.workflowCanvas.item(existing.id, workflowId).delete();
    }
};
exports.deleteCanvas = deleteCanvas;
//# sourceMappingURL=canvasRepository.js.map