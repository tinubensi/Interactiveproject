import { Container, SqlParameter, SqlQuerySpec } from '@azure/cosmos';
import { v4 as uuid } from 'uuid';
import { UnmappedField, FieldMapping, UnmappedFieldStatus } from '../models/portalTypes';
import { getCosmosContainers } from './cosmosClient';

const buildListQuery = (
  portalId?: string,
  status?: UnmappedFieldStatus
): SqlQuerySpec => {
  const filters: string[] = [];
  const parameters: SqlParameter[] = [];

  if (portalId) {
    filters.push('c.portalId = @portalId');
    parameters.push({ name: '@portalId', value: portalId });
  }

  if (status) {
    filters.push('c.status = @status');
    parameters.push({ name: '@status', value: status });
  } else {
    // Default to pending if no status specified
    filters.push('c.status = @status');
    parameters.push({ name: '@status', value: 'pending' });
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  return {
    query: `SELECT * FROM c ${whereClause} ORDER BY c.occurrenceCount DESC, c._ts DESC`,
    parameters
  };
};

const getContainer = async (): Promise<Container> => {
  const { unmappedFields } = await getCosmosContainers();
  return unmappedFields;
};

export const listUnmappedFields = async (options: {
  portalId?: string;
  status?: UnmappedFieldStatus;
  continuationToken?: string;
  pageSize?: number;
}) => {
  const container = await getContainer();
  const querySpec = buildListQuery(options.portalId, options.status);
  const iterator = container.items.query<UnmappedField>(querySpec, {
    maxItemCount: options.pageSize ?? 25,
    continuationToken: options.continuationToken
  });
  const { resources, continuationToken } = await iterator.fetchNext();
  return { items: resources ?? [], continuationToken };
};

export const getUnmappedField = async (
  id: string,
  portalId: string
): Promise<UnmappedField | null> => {
  const container = await getContainer();
  try {
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.id = @id AND c.portalId = @portalId',
      parameters: [
        { name: '@id', value: id },
        { name: '@portalId', value: portalId }
      ]
    };

    const { resources } = await container.items
      .query<UnmappedField>(querySpec, {
        partitionKey: portalId
      })
      .fetchNext();

    return resources[0] ?? null;
  } catch (error) {
    console.error('Error fetching unmapped field:', error);
    return null;
  }
};

export const createUnmappedField = async (
  field: Omit<UnmappedField, 'id' | 'occurrenceCount' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<UnmappedField> => {
  const container = await getContainer();
  const now = new Date().toISOString();
  const newField: UnmappedField = {
    ...field,
    id: uuid(),
    occurrenceCount: 1,
    status: 'pending',
    createdAt: now,
    updatedAt: now
  };
  await container.items.create(newField);
  return newField;
};

export const updateUnmappedField = async (
  field: UnmappedField
): Promise<UnmappedField> => {
  const container = await getContainer();
  const updated: UnmappedField = {
    ...field,
    updatedAt: new Date().toISOString()
  };
  await container.items.upsert(updated);
  return updated;
};

export const resolveUnmappedField = async (
  id: string,
  portalId: string,
  resolvedMapping: FieldMapping,
  resolvedBy: string
): Promise<UnmappedField> => {
  const field = await getUnmappedField(id, portalId);
  if (!field) {
    throw new Error('Unmapped field not found');
  }
  field.status = 'resolved';
  field.resolvedMapping = resolvedMapping;
  field.resolvedAt = new Date().toISOString();
  field.resolvedBy = resolvedBy;
  return updateUnmappedField(field);
};

export const ignoreUnmappedField = async (
  id: string,
  portalId: string,
  ignoredBy: string
): Promise<UnmappedField> => {
  const field = await getUnmappedField(id, portalId);
  if (!field) {
    throw new Error('Unmapped field not found');
  }
  field.status = 'ignored';
  field.resolvedAt = new Date().toISOString();
  field.resolvedBy = ignoredBy;
  return updateUnmappedField(field);
};

export const incrementOccurrenceCount = async (
  id: string,
  portalId: string
): Promise<UnmappedField> => {
  const field = await getUnmappedField(id, portalId);
  if (!field) {
    throw new Error('Unmapped field not found');
  }
  field.occurrenceCount += 1;
  return updateUnmappedField(field);
};

// Helper to find or create unmapped field
export const findOrCreateUnmappedField = async (
  portalId: string,
  fieldName: string,
  suggestedMappings: UnmappedField['suggestedMappings'] = []
): Promise<UnmappedField> => {
  const container = await getContainer();
  
  // Try to find existing unmapped field
  const querySpec = {
    query: 'SELECT * FROM c WHERE c.portalId = @portalId AND c.fieldName = @fieldName AND c.status = @status',
    parameters: [
      { name: '@portalId', value: portalId },
      { name: '@fieldName', value: fieldName },
      { name: '@status', value: 'pending' }
    ]
  };

  const { resources } = await container.items
    .query<UnmappedField>(querySpec, {
      partitionKey: portalId
    })
    .fetchNext();

  if (resources && resources.length > 0) {
    // Increment occurrence count
    const existing = resources[0];
    existing.occurrenceCount += 1;
    // Update suggested mappings if new ones provided
    if (suggestedMappings.length > 0) {
      existing.suggestedMappings = suggestedMappings;
    }
    return updateUnmappedField(existing);
  }

  // Create new unmapped field
  return createUnmappedField({
    portalId,
    fieldName,
    suggestedMappings
  });
};

