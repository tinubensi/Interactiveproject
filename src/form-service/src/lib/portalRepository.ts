import { Container, SqlParameter, SqlQuerySpec } from '@azure/cosmos';
import { PortalDefinition } from '../models/portalTypes';
import { getCosmosContainers } from './cosmosClient';

const SOFT_DELETE_FILTER = 'c.isDeleted != true OR NOT IS_DEFINED(c.isDeleted)';

const buildListQuery = (search?: string): SqlQuerySpec => {
  const filters = [SOFT_DELETE_FILTER];
  const parameters: SqlParameter[] = [];

  if (search) {
    filters.push(
      '(CONTAINS(LOWER(c.name), LOWER(@search)) OR CONTAINS(LOWER(c.description), LOWER(@search)) OR CONTAINS(LOWER(c.portalId), LOWER(@search)))'
    );
    parameters.push({ name: '@search', value: search });
  }

  return {
    query: `SELECT * FROM c WHERE ${filters.join(' AND ')} ORDER BY c._ts DESC`,
    parameters
  };
};

const getContainer = async (): Promise<Container> => {
  const { portalRegistry } = await getCosmosContainers();
  return portalRegistry;
};

export const listPortals = async (options: {
  search?: string;
  continuationToken?: string;
  pageSize?: number;
}) => {
  const container = await getContainer();
  const querySpec = buildListQuery(options.search);
  const iterator = container.items.query<PortalDefinition>(querySpec, {
    maxItemCount: options.pageSize ?? 25,
    continuationToken: options.continuationToken
  });
  const { resources, continuationToken } = await iterator.fetchNext();
  return { items: resources ?? [], continuationToken };
};

export const getPortal = async (
  portalId: string
): Promise<PortalDefinition | null> => {
  const container = await getContainer();
  try {
    const querySpec = {
      query: `SELECT * FROM c WHERE c.portalId = @portalId AND (${SOFT_DELETE_FILTER})`,
      parameters: [{ name: '@portalId', value: portalId }]
    };

    const { resources } = await container.items
      .query<PortalDefinition>(querySpec, {
        partitionKey: portalId
      })
      .fetchNext();

    return resources[0] ?? null;
  } catch (error) {
    console.error('Error fetching portal:', error);
    return null;
  }
};

export const createPortal = async (
  portal: Omit<PortalDefinition, 'createdAt' | 'updatedAt'>
): Promise<PortalDefinition> => {
  const container = await getContainer();
  const now = new Date().toISOString();
  const newPortal: PortalDefinition = {
    ...portal,
    createdAt: now,
    updatedAt: now,
    isDeleted: false
  };
  await container.items.create(newPortal);
  return newPortal;
};

export const updatePortal = async (
  portal: PortalDefinition
): Promise<PortalDefinition> => {
  const container = await getContainer();
  const updated: PortalDefinition = {
    ...portal,
    updatedAt: new Date().toISOString(),
    isDeleted: false
  };
  await container.items.upsert(updated);
  return updated;
};

export const softDeletePortal = async (
  portalId: string,
  deletedBy: string
): Promise<void> => {
  const portal = await getPortal(portalId);
  if (!portal) {
    throw new Error('Portal not found');
  }
  portal.isDeleted = true;
  portal.updatedAt = new Date().toISOString();
  portal.updatedBy = deletedBy;
  await updatePortal(portal);
};

