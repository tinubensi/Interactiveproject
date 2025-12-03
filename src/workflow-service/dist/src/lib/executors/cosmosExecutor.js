"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cosmosResultToStepResult = exports.executeCosmosDelete = exports.executeCosmosUpsert = exports.executeCosmosQuery = void 0;
const cosmosClient_1 = require("../cosmosClient");
const expressionResolver_1 = require("../engine/expressionResolver");
/**
 * Execute a Cosmos DB query
 */
const executeCosmosQuery = async (config, context) => {
    try {
        const containers = await (0, cosmosClient_1.getCosmosContainers)();
        // Resolve the query and parameters
        const query = (0, expressionResolver_1.resolveTemplate)(config.query, context);
        const parameters = config.parameters
            ? Object.entries(config.parameters).map(([name, value]) => ({
                name: name.startsWith('@') ? name : `@${name}`,
                value: (typeof value === 'string' ? (0, expressionResolver_1.resolveTemplate)(value, context) : value)
            }))
            : [];
        // Get the container - for now, we use workflowInstances as a general-purpose container
        // In production, this would need to be more flexible
        const container = containers.workflowInstances;
        const { resources } = await container.items
            .query({ query, parameters })
            .fetchAll();
        return {
            success: true,
            data: resources
        };
    }
    catch (error) {
        return {
            success: false,
            error: {
                code: 'COSMOS_QUERY_ERROR',
                message: error instanceof Error ? error.message : 'Query failed'
            }
        };
    }
};
exports.executeCosmosQuery = executeCosmosQuery;
/**
 * Execute a Cosmos DB upsert
 */
const executeCosmosUpsert = async (config, context) => {
    try {
        const containers = await (0, cosmosClient_1.getCosmosContainers)();
        // Resolve the document
        const document = (0, expressionResolver_1.resolveObject)(config.document, context);
        // Get the container
        const container = containers.workflowInstances;
        const { resource } = await container.items.upsert(document);
        return {
            success: true,
            data: resource
        };
    }
    catch (error) {
        return {
            success: false,
            error: {
                code: 'COSMOS_UPSERT_ERROR',
                message: error instanceof Error ? error.message : 'Upsert failed'
            }
        };
    }
};
exports.executeCosmosUpsert = executeCosmosUpsert;
/**
 * Execute a Cosmos DB delete
 */
const executeCosmosDelete = async (config, context) => {
    try {
        const containers = await (0, cosmosClient_1.getCosmosContainers)();
        // Resolve the document ID and partition key
        const documentId = (0, expressionResolver_1.resolveTemplate)(config.documentId, context);
        const partitionKey = (0, expressionResolver_1.resolveTemplate)(config.partitionKey, context);
        // Get the container
        const container = containers.workflowInstances;
        await container.item(documentId, partitionKey).delete();
        return {
            success: true,
            data: { deleted: true, documentId }
        };
    }
    catch (error) {
        return {
            success: false,
            error: {
                code: 'COSMOS_DELETE_ERROR',
                message: error instanceof Error ? error.message : 'Delete failed'
            }
        };
    }
};
exports.executeCosmosDelete = executeCosmosDelete;
/**
 * Convert cosmos result to step result
 */
const cosmosResultToStepResult = (result) => {
    return {
        success: result.success,
        output: result.data,
        error: result.error,
        shouldTerminate: false
    };
};
exports.cosmosResultToStepResult = cosmosResultToStepResult;
//# sourceMappingURL=cosmosExecutor.js.map