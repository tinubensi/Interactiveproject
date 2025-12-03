import {
  CosmosClient,
  Database,
  Container,
  PartitionKeyKind
} from '@azure/cosmos';
import { getConfig } from './config';

export interface CosmosContainers {
  database: Database;
  workflowDefinitions: Container;
  workflowInstances: Container;
  workflowTriggers: Container;
  workflowApprovals: Container;
  workflowTemplates: Container;
  workflowCanvas: Container;
}

let cachedContainers: CosmosContainers | undefined;

export const getCosmosContainers = async (): Promise<CosmosContainers> => {
  if (cachedContainers) {
    return cachedContainers;
  }

  const config = getConfig();
  const client = new CosmosClient({
    endpoint: config.cosmos.endpoint,
    key: config.cosmos.key
  });

  const { database } = await client.databases.createIfNotExists({
    id: config.cosmos.databaseId
  });

  // Workflow definitions container - partitioned by workflowId
  const { container: workflowDefinitions } =
    await database.containers.createIfNotExists({
      id: config.cosmos.workflowDefinitionsContainerId,
      partitionKey: { paths: ['/workflowId'], kind: PartitionKeyKind.Hash }
    });

  // Workflow instances container - partitioned by instanceId with TTL
  const { container: workflowInstances } =
    await database.containers.createIfNotExists({
      id: config.cosmos.workflowInstancesContainerId,
      partitionKey: { paths: ['/instanceId'], kind: PartitionKeyKind.Hash },
      defaultTtl: config.settings.instanceTtlSeconds
    });

  // Workflow triggers container - partitioned by eventType for fast event routing
  const { container: workflowTriggers } =
    await database.containers.createIfNotExists({
      id: config.cosmos.workflowTriggersContainerId,
      partitionKey: { paths: ['/eventType'], kind: PartitionKeyKind.Hash }
    });

  // Workflow approvals container - partitioned by approverId with TTL
  const { container: workflowApprovals } =
    await database.containers.createIfNotExists({
      id: config.cosmos.workflowApprovalsContainerId,
      partitionKey: { paths: ['/instanceId'], kind: PartitionKeyKind.Hash },
      defaultTtl: config.settings.approvalTtlSeconds
    });

  // Workflow templates container - partitioned by templateId
  const { container: workflowTemplates } =
    await database.containers.createIfNotExists({
      id: config.cosmos.workflowTemplatesContainerId,
      partitionKey: { paths: ['/templateId'], kind: PartitionKeyKind.Hash }
    });

  // Workflow canvas container - partitioned by workflowId
  const { container: workflowCanvas } =
    await database.containers.createIfNotExists({
      id: config.cosmos.workflowCanvasContainerId,
      partitionKey: { paths: ['/workflowId'], kind: PartitionKeyKind.Hash }
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

export const resetContainersCache = (): void => {
  cachedContainers = undefined;
};

