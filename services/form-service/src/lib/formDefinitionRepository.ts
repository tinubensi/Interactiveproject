import { Container, SqlParameter, SqlQuerySpec } from '@azure/cosmos';
import { v4 as uuid } from 'uuid';
import { FormTemplate } from '../models/formTypes';
import { getCosmosContainers } from './cosmosClient';

const SOFT_DELETE_FILTER = 'c.isDeleted != true OR NOT IS_DEFINED(c.isDeleted)';

const buildListQuery = (
  insuranceLine?: string,
  status?: string,
  search?: string
): SqlQuerySpec => {
  const filters = [SOFT_DELETE_FILTER];
  const parameters: SqlParameter[] = [];

  if (insuranceLine) {
    filters.push('c.insuranceLine = @insuranceLine');
    parameters.push({ name: '@insuranceLine', value: insuranceLine });
  }

  if (status) {
    filters.push('c.status = @status');
    parameters.push({ name: '@status', value: status });
  }

  if (search) {
    filters.push(
      '(CONTAINS(LOWER(c.name), LOWER(@search)) OR CONTAINS(LOWER(c.description), LOWER(@search)))'
    );
    parameters.push({ name: '@search', value: search });
  }

  return {
    query: `SELECT * FROM c WHERE ${filters.join(' AND ')} ORDER BY c._ts DESC`,
    parameters
  };
};

const getContainer = async (): Promise<Container> => {
  const { formDefinitions } = await getCosmosContainers();
  return formDefinitions;
};

export const listFormTemplates = async (options: {
  insuranceLine?: string;
  status?: string;
  search?: string;
  continuationToken?: string;
  pageSize?: number;
}) => {
  const container = await getContainer();
  const querySpec = buildListQuery(
    options.insuranceLine,
    options.status,
    options.search
  );
  const iterator = container.items.query<FormTemplate>(querySpec, {
    maxItemCount: options.pageSize ?? 25,
    continuationToken: options.continuationToken
  });
  const { resources, continuationToken } = await iterator.fetchNext();
  return { items: resources ?? [], continuationToken };
};

export const getFormTemplate = async (
  templateId: string,
  insuranceLine: string
): Promise<FormTemplate | null> => {
  const container = await getContainer();
  try {
    // Query by templateId field instead of document id
    const querySpec = {
      query: `SELECT * FROM c WHERE c.templateId = @templateId AND c.insuranceLine = @insuranceLine AND (${SOFT_DELETE_FILTER})`,
      parameters: [
        { name: '@templateId', value: templateId },
        { name: '@insuranceLine', value: insuranceLine }
      ]
    };

    const { resources } = await container.items.query<FormTemplate>(querySpec, {
      partitionKey: insuranceLine
    }).fetchNext();

    return resources[0] ?? null;
  } catch (error) {
    console.error('Error fetching template:', error);
    return null;
  }
};

export const createFormTemplate = async (
  template: Omit<FormTemplate, 'templateId' | 'version' | 'createdAt'>
): Promise<FormTemplate> => {
  const container = await getContainer();
  const now = new Date().toISOString();
  const newTemplate: FormTemplate = {
    ...template,
    templateId: uuid(),
    version: 1,
    createdAt: now,
    isDeleted: false,
  };
  await container.items.create(newTemplate);
  return newTemplate;
};

export const updateFormTemplate = async (
  template: FormTemplate
): Promise<FormTemplate> => {
  const container = await getContainer();
  const updated: FormTemplate = {
    ...template,
    updatedAt: new Date().toISOString(),
    isDeleted: false,
  };
  await container.items.upsert(updated);
  return updated;
};

export const softDeleteFormTemplate = async (
  templateId: string,
  insuranceLine: string,
  deletedBy: string
): Promise<void> => {
  const template = await getFormTemplate(templateId, insuranceLine);
  if (!template) {
    throw new Error('Template not found');
  }
  template.isDeleted = true;
  template.updatedAt = new Date().toISOString();
  template.updatedBy = deletedBy;
  await updateFormTemplate(template);
};

