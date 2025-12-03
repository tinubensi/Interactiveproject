import {
  CosmosClient,
  Database,
  Container,
  PartitionKeyKind
} from '@azure/cosmos';
import { getConfig } from './config';

export interface CosmosContainers {
  database: Database;
  formDefinitions: Container;
  intakeForms: Container;
  portalRegistry: Container;
  unmappedFields: Container;
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

  const { container: formDefinitions } =
    await database.containers.createIfNotExists({
      id: config.cosmos.formDefinitionsContainerId,
      partitionKey: { paths: ['/insuranceLine'], kind: PartitionKeyKind.Hash }
    });

  const { container: intakeForms } =
    await database.containers.createIfNotExists({
      id: config.cosmos.intakeFormsContainerId,
      partitionKey: { paths: ['/intakeId'], kind: PartitionKeyKind.Hash }
    });

  const { container: portalRegistry } =
    await database.containers.createIfNotExists({
      id: config.cosmos.portalRegistryContainerId,
      partitionKey: { paths: ['/portalId'], kind: PartitionKeyKind.Hash }
    });

  const { container: unmappedFields } =
    await database.containers.createIfNotExists({
      id: config.cosmos.unmappedFieldsContainerId,
      partitionKey: { paths: ['/portalId'], kind: PartitionKeyKind.Hash }
    });

  cachedContainers = {
    database,
    formDefinitions,
    intakeForms,
    portalRegistry,
    unmappedFields
  };

  return cachedContainers;
};

