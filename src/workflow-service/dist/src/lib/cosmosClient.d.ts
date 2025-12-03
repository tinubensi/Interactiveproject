import { Database, Container } from '@azure/cosmos';
export interface CosmosContainers {
    database: Database;
    workflowDefinitions: Container;
    workflowInstances: Container;
    workflowTriggers: Container;
    workflowApprovals: Container;
    workflowTemplates: Container;
    workflowCanvas: Container;
}
export declare const getCosmosContainers: () => Promise<CosmosContainers>;
export declare const resetContainersCache: () => void;
//# sourceMappingURL=cosmosClient.d.ts.map