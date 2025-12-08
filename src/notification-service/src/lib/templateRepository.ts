/**
 * Template Repository - CRUD operations for notification templates
 */

import { v4 as uuidv4 } from 'uuid';
import { getTemplatesContainer } from './cosmosClient';
import {
  NotificationTemplateDocument,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateSummary,
} from '../models/NotificationTemplate';

/**
 * Create a new template
 */
export async function createTemplate(
  request: CreateTemplateRequest,
  createdBy: string
): Promise<NotificationTemplateDocument> {
  const container = getTemplatesContainer();
  const now = new Date().toISOString();

  const document: NotificationTemplateDocument = {
    id: uuidv4(),
    templateId: request.templateId,
    name: request.name,
    description: request.description,
    category: request.category,
    type: request.type,
    priority: request.priority,
    content: request.content,
    variables: request.variables,
    action: request.action,
    defaultChannels: request.defaultChannels,
    isActive: true,
    isSystem: false,
    createdAt: now,
    createdBy,
    updatedAt: now,
    updatedBy: createdBy,
  };

  const { resource } = await container.items.create(document);

  if (!resource) {
    throw new Error('Failed to create template');
  }

  return resource;
}

/**
 * Create a system template (for seeding)
 */
export async function createSystemTemplate(
  request: CreateTemplateRequest
): Promise<NotificationTemplateDocument> {
  const container = getTemplatesContainer();
  const now = new Date().toISOString();

  const document: NotificationTemplateDocument = {
    id: uuidv4(),
    templateId: request.templateId,
    name: request.name,
    description: request.description,
    category: request.category,
    type: request.type,
    priority: request.priority,
    content: request.content,
    variables: request.variables,
    action: request.action,
    defaultChannels: request.defaultChannels,
    isActive: true,
    isSystem: true,
    createdAt: now,
    createdBy: 'system',
    updatedAt: now,
    updatedBy: 'system',
  };

  const { resource } = await container.items.create(document);

  if (!resource) {
    throw new Error('Failed to create system template');
  }

  return resource;
}

/**
 * Find template by ID
 */
export async function findTemplateById(
  templateId: string
): Promise<NotificationTemplateDocument | null> {
  const container = getTemplatesContainer();

  const { resources } = await container.items
    .query<NotificationTemplateDocument>({
      query: 'SELECT * FROM c WHERE c.templateId = @templateId',
      parameters: [{ name: '@templateId', value: templateId }],
    })
    .fetchAll();

  return resources[0] || null;
}

/**
 * List all templates
 */
export async function listTemplates(
  includeInactive: boolean = false
): Promise<TemplateSummary[]> {
  const container = getTemplatesContainer();

  let queryText = 'SELECT * FROM c';
  if (!includeInactive) {
    queryText += ' WHERE c.isActive = true';
  }
  queryText += ' ORDER BY c.category, c.name';

  const { resources } = await container.items
    .query<NotificationTemplateDocument>(queryText)
    .fetchAll();

  return resources.map((t) => ({
    templateId: t.templateId,
    name: t.name,
    category: t.category,
    type: t.type,
    isActive: t.isActive,
    isSystem: t.isSystem,
    defaultChannels: t.defaultChannels,
  }));
}

/**
 * Update template
 */
export async function updateTemplate(
  templateId: string,
  updates: UpdateTemplateRequest,
  updatedBy: string
): Promise<NotificationTemplateDocument> {
  const existing = await findTemplateById(templateId);

  if (!existing) {
    throw new Error(`Template "${templateId}" not found`);
  }

  if (existing.isSystem) {
    throw new Error('Cannot modify system templates');
  }

  const container = getTemplatesContainer();
  const now = new Date().toISOString();

  const updated: NotificationTemplateDocument = {
    ...existing,
    name: updates.name ?? existing.name,
    description: updates.description ?? existing.description,
    category: updates.category ?? existing.category,
    type: updates.type ?? existing.type,
    priority: updates.priority ?? existing.priority,
    content: updates.content ?? existing.content,
    variables: updates.variables ?? existing.variables,
    action: updates.action ?? existing.action,
    defaultChannels: updates.defaultChannels ?? existing.defaultChannels,
    isActive: updates.isActive ?? existing.isActive,
    updatedAt: now,
    updatedBy,
  };

  const { resource } = await container
    .item(existing.id, existing.templateId)
    .replace(updated);

  if (!resource) {
    throw new Error('Failed to update template');
  }

  return resource;
}

/**
 * Delete template
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  const existing = await findTemplateById(templateId);

  if (!existing) {
    throw new Error(`Template "${templateId}" not found`);
  }

  if (existing.isSystem) {
    throw new Error('Cannot delete system templates');
  }

  const container = getTemplatesContainer();
  await container.item(existing.id, existing.templateId).delete();
}

/**
 * Check if template exists
 */
export async function templateExists(templateId: string): Promise<boolean> {
  const template = await findTemplateById(templateId);
  return template !== null;
}

