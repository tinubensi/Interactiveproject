import { CanvasState, SaveCanvasRequest } from '../../models/workflowTypes';
export declare class CanvasNotFoundError extends Error {
    constructor(workflowId: string);
}
export declare const getCanvas: (workflowId: string) => Promise<CanvasState | null>;
export declare const saveCanvas: (workflowId: string, request: SaveCanvasRequest, userId: string) => Promise<CanvasState>;
export declare const deleteCanvas: (workflowId: string) => Promise<void>;
//# sourceMappingURL=canvasRepository.d.ts.map