"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetContainersCache = exports.getCosmosContainers = void 0;
const cosmos_1 = require("@azure/cosmos");
const config_1 = require("./config");
let cachedContainers;
const getCosmosContainers = async () => {
    if (cachedContainers) {
        return cachedContainers;
    }
    const config = (0, config_1.getConfig)();
    const client = new cosmos_1.CosmosClient({
        endpoint: config.cosmos.endpoint,
        key: config.cosmos.key
    });
    const { database } = await client.databases.createIfNotExists({
        id: config.cosmos.databaseId
    });
    // Workflow definitions container - partitioned by workflowId
    const { container: workflowDefinitions } = await database.containers.createIfNotExists({
        id: config.cosmos.workflowDefinitionsContainerId,
        partitionKey: { paths: ['/workflowId'], kind: cosmos_1.PartitionKeyKind.Hash }
    });
    // Workflow instances container - partitioned by instanceId with TTL
    const { container: workflowInstances } = await database.containers.createIfNotExists({
        id: config.cosmos.workflowInstancesContainerId,
        partitionKey: { paths: ['/instanceId'], kind: cosmos_1.PartitionKeyKind.Hash },
        defaultTtl: config.settings.instanceTtlSeconds
    });
    // Workflow triggers container - partitioned by eventType for fast event routing
    const { container: workflowTriggers } = await database.containers.createIfNotExists({
        id: config.cosmos.workflowTriggersContainerId,
        partitionKey: { paths: ['/eventType'], kind: cosmos_1.PartitionKeyKind.Hash }
    });
    // Workflow approvals container - partitioned by approverId with TTL
    const { container: workflowApprovals } = await database.containers.createIfNotExists({
        id: config.cosmos.workflowApprovalsContainerId,
        partitionKey: { paths: ['/instanceId'], kind: cosmos_1.PartitionKeyKind.Hash },
        defaultTtl: config.settings.approvalTtlSeconds
    });
    // Workflow templates container - partitioned by templateId
    const { container: workflowTemplates } = await database.containers.createIfNotExists({
        id: config.cosmos.workflowTemplatesContainerId,
        partitionKey: { paths: ['/templateId'], kind: cosmos_1.PartitionKeyKind.Hash }
    });
    // Workflow canvas container - partitioned by workflowId
    const { container: workflowCanvas } = await database.containers.createIfNotExists({
        id: config.cosmos.workflowCanvasContainerId,
        partitionKey: { paths: ['/workflowId'], kind: cosmos_1.PartitionKeyKind.Hash }
    });
    cachedContainers = {
        database,
        workflowDefinitions,
        workflowInstances,
        workflowTriggers,
        workflowApprovals,
        workflowTemplates,
        workflowCanvas
    };
    return cachedContainers;
};
exports.getCosmosContainers = getCosmosContainers;
const resetContainersCache = () => {
    cachedContainers = undefined;
};
exports.resetContainersCache = resetContainersCache;
//# sourceMappingURL=cosmosClient.js.map