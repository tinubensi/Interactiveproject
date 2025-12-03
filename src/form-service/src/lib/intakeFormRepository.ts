import { Container, SqlParameter, SqlQuerySpec } from '@azure/cosmos';
import { generateId } from './idGenerator';
import { FormIntake } from '../models/formTypes';
import { getCosmosContainers } from './cosmosClient';

const getContainer = async (): Promise<Container> => {
  const { intakeForms } = await getCosmosContainers();
  return intakeForms;
};

export const createDraftIntake = async (
  intake: Omit<FormIntake, 'id' | 'intakeId' | 'createdAt'>
): Promise<FormIntake> => {
  const container = await getContainer();
  const now = new Date().toISOString();
  const intakeId = generateId();
  const newIntake: FormIntake = {
    ...intake,
    id: intakeId,
    intakeId: intakeId,
    createdAt: now,
    isDeleted: false,
  };
  await container.items.create(newIntake);
  return newIntake;
};

export const getIntake = async (
  intakeId: string
): Promise<FormIntake | null> => {
  const container = await getContainer();
  try {
    const { resource } = await container.item(intakeId, intakeId).read();
    return resource as FormIntake;
  } catch (error) {
    return null;
  }
};

export const upsertIntake = async (
  intake: FormIntake
): Promise<FormIntake> => {
  const container = await getContainer();
  const updated: FormIntake = {
    ...intake,
    id: intake.intakeId,
    updatedAt: new Date().toISOString(),
    isDeleted: false,
  };
  await container.items.upsert(updated);
  return updated;
};

export const listIntakesByTemplate = async (
  templateId: string,
  continuationToken?: string
) => {
  const container = await getContainer();
  const iterator = container.items.query<FormIntake>(
    {
      query:
        'SELECT * FROM c WHERE c.templateId = @templateId ORDER BY c._ts DESC',
      parameters: [{ name: '@templateId', value: templateId }]
    },
    {
      continuationToken
    }
  );
  return iterator.fetchNext();
};

const buildListAllIntakesQuery = (
  status?: string,
  insuranceLine?: string,
  search?: string
): SqlQuerySpec => {
  const filters: string[] = [];
  const parameters: SqlParameter[] = [];

  // Filter out deleted intakes
  filters.push('(c.isDeleted != true OR NOT IS_DEFINED(c.isDeleted))');

  if (status && status !== 'all') {
    filters.push('c.status = @status');
    parameters.push({ name: '@status', value: status });
  }

  if (insuranceLine && insuranceLine !== 'all') {
    filters.push('c.insuranceLine = @insuranceLine');
    parameters.push({ name: '@insuranceLine', value: insuranceLine });
  }

  if (search) {
    filters.push(
      '(CONTAINS(LOWER(c.intakeId), LOWER(@search)) OR CONTAINS(LOWER(c.templateId), LOWER(@search)) OR CONTAINS(LOWER(c.customerId), LOWER(@search)))'
    );
    parameters.push({ name: '@search', value: search });
  }

  return {
    query: `SELECT * FROM c WHERE ${filters.join(' AND ')} ORDER BY c._ts DESC`,
    parameters
  };
};

export const listAllIntakes = async (options: {
  status?: string;
  insuranceLine?: string;
  search?: string;
  continuationToken?: string;
  pageSize?: number;
}) => {
  const container = await getContainer();
  const querySpec = buildListAllIntakesQuery(
    options.status,
    options.insuranceLine,
    options.search
  );
  const iterator = container.items.query<FormIntake>(querySpec, {
    maxItemCount: options.pageSize ?? 25,
    continuationToken: options.continuationToken
  });
  const { resources, continuationToken } = await iterator.fetchNext();
  return { items: resources ?? [], continuationToken };
};

