/**
 * Cosmos DB Service for Policy Service
 */

import { CosmosClient, Container, Database, SqlQuerySpec } from '@azure/cosmos';
import { Policy, PolicyRequest, PolicyRequestListRequest, PolicyRequestListResponse, PolicyListRequest, PolicyListResponse } from '../models/policy';

class CosmosService {
  private client: CosmosClient;
  private database: Database;
  private policyRequestsContainer: Container;
  private policiesContainer: Container;

  constructor() {
    const endpoint = process.env.COSMOS_DB_ENDPOINT!;
    const key = process.env.COSMOS_DB_KEY!;
    const databaseName = process.env.COSMOS_DB_NAME || 'PolicyDB';

    this.client = new CosmosClient({ endpoint, key });
    this.database = this.client.database(databaseName);
    this.policyRequestsContainer = this.database.container('policyRequests');
    this.policiesContainer = this.database.container('policies');
  }

  async initialize(): Promise<void> {
    try {
      await this.client.databases.createIfNotExists({ id: process.env.COSMOS_DB_NAME || 'PolicyDB' });

      await this.database.containers.createIfNotExists({
        id: 'policyRequests',
        partitionKey: { paths: ['/quotationId'] }
      });

      await this.database.containers.createIfNotExists({
        id: 'policies',
        partitionKey: { paths: ['/customerId'] }
      });

      console.log('PolicyDB initialized successfully');
    } catch (error) {
      console.error('Error initializing Cosmos DB:', error);
      throw error;
    }
  }

  // ==================== POLICY REQUESTS ====================

  async createPolicyRequest(request: PolicyRequest): Promise<PolicyRequest> {
    const { resource } = await this.policyRequestsContainer.items.create(request);
    return resource as PolicyRequest;
  }

  async getPolicyRequestById(id: string, quotationId: string): Promise<PolicyRequest | null> {
    try {
      const { resource } = await this.policyRequestsContainer.item(id, quotationId).read<PolicyRequest>();
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) return null;
      throw error;
    }
  }

  async getPolicyRequestsByQuotation(quotationId: string): Promise<PolicyRequest[]> {
    const query: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE c.quotationId = @quotationId ORDER BY c.createdAt DESC',
      parameters: [{ name: '@quotationId', value: quotationId }]
    };
    const { resources } = await this.policyRequestsContainer.items.query<PolicyRequest>(query).fetchAll();
    return resources;
  }

  async updatePolicyRequest(id: string, quotationId: string, updates: Partial<PolicyRequest>): Promise<PolicyRequest> {
    const existing = await this.getPolicyRequestById(id, quotationId);
    if (!existing) throw new Error('Policy request not found');

    const updated = { ...existing, ...updates, updatedAt: new Date() };
    const { resource } = await this.policyRequestsContainer.item(id, quotationId).replace(updated);
    return resource as PolicyRequest;
  }

  async listPolicyRequests(request: PolicyRequestListRequest): Promise<PolicyRequestListResponse> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', filters = {} } = request;

    const conditions: string[] = [];
    const parameters: Array<{ name: string; value: any }> = [];
    let paramIndex = 0;

    if (request.quotationId) {
      conditions.push(`c.quotationId = @quotationId${paramIndex}`);
      parameters.push({ name: `@quotationId${paramIndex}`, value: request.quotationId });
      paramIndex++;
    }

    if (request.leadId) {
      conditions.push(`c.leadId = @leadId${paramIndex}`);
      parameters.push({ name: `@leadId${paramIndex}`, value: request.leadId });
      paramIndex++;
    }

    if (filters.status && filters.status.length > 0) {
      conditions.push(`ARRAY_CONTAINS(@statuses${paramIndex}, c.status)`);
      parameters.push({ name: `@statuses${paramIndex}`, value: filters.status });
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const orderByClause = `ORDER BY c.${sortBy} ${orderDirection}`;

    const countQuery: SqlQuerySpec = {
      query: `SELECT VALUE COUNT(1) FROM c ${whereClause}`,
      parameters
    };
    const { resources: countResult } = await this.policyRequestsContainer.items.query(countQuery).fetchAll();
    const totalRecords = countResult[0] || 0;

    const offset = (page - 1) * limit;
    const dataQuery: SqlQuerySpec = {
      query: `SELECT * FROM c ${whereClause} ${orderByClause} OFFSET ${offset} LIMIT ${limit}`,
      parameters
    };
    const { resources: requests } = await this.policyRequestsContainer.items.query<PolicyRequest>(dataQuery).fetchAll();

    const totalPages = Math.ceil(totalRecords / limit);

    return {
      data: requests,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1
      },
      filters: {
        applied: filters,
        available: {
          statuses: [],
          vendors: []
        }
      },
      sort: { sortBy, sortOrder }
    };
  }

  // ==================== POLICIES ====================

  async createPolicy(policy: Policy): Promise<Policy> {
    const { resource } = await this.policiesContainer.items.create(policy);
    return resource as Policy;
  }

  async getPolicyById(id: string, customerId: string): Promise<Policy | null> {
    try {
      const { resource } = await this.policiesContainer.item(id, customerId).read<Policy>();
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) return null;
      throw error;
    }
  }

  async getPoliciesByCustomer(customerId: string): Promise<Policy[]> {
    const query: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE c.customerId = @customerId ORDER BY c.issueDate DESC',
      parameters: [{ name: '@customerId', value: customerId }]
    };
    const { resources } = await this.policiesContainer.items.query<Policy>(query).fetchAll();
    return resources;
  }

  async updatePolicy(id: string, customerId: string, updates: Partial<Policy>): Promise<Policy> {
    const existing = await this.getPolicyById(id, customerId);
    if (!existing) throw new Error('Policy not found');

    const updated = { ...existing, ...updates, updatedAt: new Date() };
    const { resource } = await this.policiesContainer.item(id, customerId).replace(updated);
    return resource as Policy;
  }

  async listPolicies(request: PolicyListRequest): Promise<PolicyListResponse> {
    const { page = 1, limit = 20, sortBy = 'issueDate', sortOrder = 'desc', filters = {} } = request;

    const conditions: string[] = [];
    const parameters: Array<{ name: string; value: any }> = [];
    let paramIndex = 0;

    if (request.customerId) {
      conditions.push(`c.customerId = @customerId${paramIndex}`);
      parameters.push({ name: `@customerId${paramIndex}`, value: request.customerId });
      paramIndex++;
    }

    if (filters.status && filters.status.length > 0) {
      conditions.push(`ARRAY_CONTAINS(@statuses${paramIndex}, c.status)`);
      parameters.push({ name: `@statuses${paramIndex}`, value: filters.status });
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const orderByClause = `ORDER BY c.${sortBy} ${orderDirection}`;

    const countQuery: SqlQuerySpec = {
      query: `SELECT VALUE COUNT(1) FROM c ${whereClause}`,
      parameters
    };
    const { resources: countResult } = await this.policiesContainer.items.query(countQuery).fetchAll();
    const totalRecords = countResult[0] || 0;

    const offset = (page - 1) * limit;
    const dataQuery: SqlQuerySpec = {
      query: `SELECT * FROM c ${whereClause} ${orderByClause} OFFSET ${offset} LIMIT ${limit}`,
      parameters
    };
    const { resources: policies } = await this.policiesContainer.items.query<Policy>(dataQuery).fetchAll();

    const totalPages = Math.ceil(totalRecords / limit);

    return {
      data: policies,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1
      },
      filters: {
        applied: filters,
        available: {
          statuses: [],
          vendors: []
        }
      },
      sort: { sortBy, sortOrder }
    };
  }
}

export const cosmosService = new CosmosService();


