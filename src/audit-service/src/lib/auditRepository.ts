/**
 * Audit Repository - CRUD operations for audit logs (append-only)
 */

import { v4 as uuidv4 } from 'uuid';
import { getLogsContainer } from './cosmosClient';
import { getConfig } from './config';
import { 
  AuditLogDocument, 
  AuditLogQueryResponse,
  SearchAuditRequest,
  AuditCategory,
  AuditSeverity,
  AuditActor,
  AuditContext,
  AuditChanges,
} from '../models/AuditLog';

/**
 * Create a new audit log entry
 * Note: This is append-only - no update or delete methods
 */
export async function createAuditLog(
  params: {
    entityType: string;
    entityId: string;
    action: string;
    category: AuditCategory;
    severity: AuditSeverity;
    actor: AuditActor;
    context: AuditContext;
    changes?: AuditChanges;
    metadata?: Record<string, unknown>;
    timestamp?: string;
  }
): Promise<AuditLogDocument> {
  const container = getLogsContainer();
  const now = params.timestamp || new Date().toISOString();

  const document: AuditLogDocument = {
    id: uuidv4(),
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    category: params.category,
    severity: params.severity,
    actor: params.actor,
    context: params.context,
    changes: params.changes,
    metadata: params.metadata,
    timestamp: now,
  };

  const { resource } = await container.items.create(document);

  if (!resource) {
    throw new Error('Failed to create audit log');
  }

  return resource;
}

/**
 * Query audit logs by entity
 */
export async function queryByEntity(
  entityType: string,
  entityId: string,
  options?: {
    limit?: number;
    continuationToken?: string;
  }
): Promise<AuditLogQueryResponse> {
  const config = getConfig();
  const container = getLogsContainer();
  const limit = Math.min(options?.limit || config.query.defaultLimit, config.query.maxLimit);

  const querySpec = {
    query: `SELECT * FROM c WHERE c.entityType = @entityType AND c.entityId = @entityId ORDER BY c.timestamp DESC`,
    parameters: [
      { name: '@entityType', value: entityType },
      { name: '@entityId', value: entityId },
    ],
  };

  const queryOptions: { maxItemCount: number; continuationToken?: string } = {
    maxItemCount: limit,
  };

  if (options?.continuationToken) {
    queryOptions.continuationToken = options.continuationToken;
  }

  const { resources, continuationToken } = await container.items
    .query<AuditLogDocument>(querySpec, queryOptions)
    .fetchNext();

  // Get total count
  const countQuery = {
    query: `SELECT VALUE COUNT(1) FROM c WHERE c.entityType = @entityType AND c.entityId = @entityId`,
    parameters: [
      { name: '@entityType', value: entityType },
      { name: '@entityId', value: entityId },
    ],
  };

  const { resources: countResult } = await container.items.query(countQuery).fetchAll();
  const totalCount = countResult[0] || 0;

  return {
    entityType,
    entityId,
    totalCount,
    logs: resources,
    continuationToken: continuationToken || undefined,
  };
}

/**
 * Query audit logs by user (actor)
 */
export async function queryByUser(
  userId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    action?: string;
    limit?: number;
    continuationToken?: string;
  }
): Promise<AuditLogQueryResponse> {
  const config = getConfig();
  const container = getLogsContainer();
  const limit = Math.min(options?.limit || config.query.defaultLimit, config.query.maxLimit);

  let query = `SELECT * FROM c WHERE c.actor.id = @userId`;
  const parameters: { name: string; value: string }[] = [
    { name: '@userId', value: userId },
  ];

  if (options?.startDate) {
    query += ` AND c.timestamp >= @startDate`;
    parameters.push({ name: '@startDate', value: options.startDate });
  }

  if (options?.endDate) {
    query += ` AND c.timestamp <= @endDate`;
    parameters.push({ name: '@endDate', value: options.endDate });
  }

  if (options?.action) {
    query += ` AND c.action = @action`;
    parameters.push({ name: '@action', value: options.action });
  }

  query += ` ORDER BY c.timestamp DESC`;

  const queryOptions: { maxItemCount: number; continuationToken?: string } = {
    maxItemCount: limit,
  };

  if (options?.continuationToken) {
    queryOptions.continuationToken = options.continuationToken;
  }

  const { resources, continuationToken } = await container.items
    .query<AuditLogDocument>({ query, parameters }, queryOptions)
    .fetchNext();

  // Get user email from first result
  const email = resources[0]?.actor?.email || '';

  return {
    userId,
    email,
    totalCount: resources.length, // Approximate for user queries
    logs: resources,
    continuationToken: continuationToken || undefined,
  };
}

/**
 * Search audit logs with multiple filters
 */
export async function searchAuditLogs(
  request: SearchAuditRequest
): Promise<AuditLogQueryResponse> {
  const config = getConfig();
  const container = getLogsContainer();
  const limit = Math.min(request.limit || config.query.defaultLimit, config.query.maxLimit);

  // Validate date range
  const startDate = new Date(request.startDate);
  const endDate = new Date(request.endDate);
  const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysDiff > config.query.maxDateRangeDays) {
    throw new Error(`Date range cannot exceed ${config.query.maxDateRangeDays} days`);
  }

  let query = `SELECT * FROM c WHERE c.timestamp >= @startDate AND c.timestamp <= @endDate`;
  const parameters: { name: string; value: string }[] = [
    { name: '@startDate', value: request.startDate },
    { name: '@endDate', value: request.endDate },
  ];

  if (request.filters?.entityType) {
    query += ` AND c.entityType = @entityType`;
    parameters.push({ name: '@entityType', value: request.filters.entityType });
  }

  if (request.filters?.action) {
    query += ` AND c.action = @action`;
    parameters.push({ name: '@action', value: request.filters.action });
  }

  if (request.filters?.actorId) {
    query += ` AND c.actor.id = @actorId`;
    parameters.push({ name: '@actorId', value: request.filters.actorId });
  }

  if (request.filters?.category) {
    query += ` AND c.category = @category`;
    parameters.push({ name: '@category', value: request.filters.category });
  }

  if (request.filters?.severity) {
    query += ` AND c.severity = @severity`;
    parameters.push({ name: '@severity', value: request.filters.severity });
  }

  query += ` ORDER BY c.timestamp DESC`;

  const queryOptions: { maxItemCount: number; continuationToken?: string } = {
    maxItemCount: limit,
  };

  if (request.continuationToken) {
    queryOptions.continuationToken = request.continuationToken;
  }

  const { resources, continuationToken } = await container.items
    .query<AuditLogDocument>({ query, parameters }, queryOptions)
    .fetchNext();

  return {
    totalCount: resources.length,
    logs: resources,
    continuationToken: continuationToken || undefined,
  };
}

/**
 * Count logs by date range (for exports)
 */
export async function countByDateRange(
  startDate: string,
  endDate: string,
  filters?: SearchAuditRequest['filters']
): Promise<number> {
  const container = getLogsContainer();

  let query = `SELECT VALUE COUNT(1) FROM c WHERE c.timestamp >= @startDate AND c.timestamp <= @endDate`;
  const parameters: { name: string; value: string }[] = [
    { name: '@startDate', value: startDate },
    { name: '@endDate', value: endDate },
  ];

  if (filters?.entityType) {
    query += ` AND c.entityType = @entityType`;
    parameters.push({ name: '@entityType', value: filters.entityType });
  }

  if (filters?.action) {
    query += ` AND c.action = @action`;
    parameters.push({ name: '@action', value: filters.action });
  }

  if (filters?.category) {
    query += ` AND c.category = @category`;
    parameters.push({ name: '@category', value: filters.category });
  }

  const { resources } = await container.items.query({ query, parameters }).fetchAll();
  return resources[0] || 0;
}

/**
 * Get all logs for export (with pagination internally)
 */
export async function* getAllLogsForExport(
  startDate: string,
  endDate: string,
  filters?: SearchAuditRequest['filters'],
  maxRecords?: number
): AsyncGenerator<AuditLogDocument[], void, unknown> {
  const config = getConfig();
  const container = getLogsContainer();
  const batchSize = 1000;
  const limit = maxRecords || config.export.maxRecords;

  let query = `SELECT * FROM c WHERE c.timestamp >= @startDate AND c.timestamp <= @endDate`;
  const parameters: { name: string; value: string }[] = [
    { name: '@startDate', value: startDate },
    { name: '@endDate', value: endDate },
  ];

  if (filters?.entityType) {
    query += ` AND c.entityType = @entityType`;
    parameters.push({ name: '@entityType', value: filters.entityType });
  }

  if (filters?.action) {
    query += ` AND c.action = @action`;
    parameters.push({ name: '@action', value: filters.action });
  }

  if (filters?.category) {
    query += ` AND c.category = @category`;
    parameters.push({ name: '@category', value: filters.category });
  }

  query += ` ORDER BY c.timestamp DESC`;

  let continuationToken: string | undefined;
  let totalYielded = 0;

  do {
    const queryOptions: { maxItemCount: number; continuationToken?: string } = {
      maxItemCount: batchSize,
    };

    if (continuationToken) {
      queryOptions.continuationToken = continuationToken;
    }

    const response = await container.items
      .query<AuditLogDocument>({ query, parameters }, queryOptions)
      .fetchNext();

    continuationToken = response.continuationToken || undefined;

    if (response.resources.length > 0) {
      const remaining = limit - totalYielded;
      const batch = response.resources.slice(0, remaining);
      totalYielded += batch.length;
      yield batch;
    }
  } while (continuationToken && totalYielded < limit);
}

