/**
 * Cosmos DB Service for Quotation Service
 */

import { CosmosClient, Container, Database, SqlQuerySpec } from '@azure/cosmos';
import { Quotation, QuotationPlan, QuotationRevision, QuotationListRequest, QuotationListResponse } from '../models/quotation';

class CosmosService {
  private client: CosmosClient;
  private database: Database;
  private quotationsContainer: Container;
  private quotationPlansContainer: Container;
  private revisionsContainer: Container;

  constructor() {
    const endpoint = process.env.COSMOS_DB_ENDPOINT!;
    const key = process.env.COSMOS_DB_KEY!;
    const databaseName = process.env.COSMOS_DB_NAME || 'QuotationDB';

    this.client = new CosmosClient({ endpoint, key });
    this.database = this.client.database(databaseName);
    this.quotationsContainer = this.database.container('quotations');
    this.quotationPlansContainer = this.database.container('quotationPlans');
    this.revisionsContainer = this.database.container('revisions');
  }

  async initialize(): Promise<void> {
    try {
      await this.client.databases.createIfNotExists({ id: process.env.COSMOS_DB_NAME || 'QuotationDB' });

      await this.database.containers.createIfNotExists({
        id: 'quotations',
        partitionKey: { paths: ['/leadId'] }
      });

      await this.database.containers.createIfNotExists({
        id: 'quotationPlans',
        partitionKey: { paths: ['/quotationId'] }
      });

      await this.database.containers.createIfNotExists({
        id: 'revisions',
        partitionKey: { paths: ['/quotationId'] }
      });

      console.log('QuotationDB initialized successfully');
    } catch (error) {
      console.error('Error initializing Cosmos DB:', error);
      throw error;
    }
  }

  // ==================== QUOTATIONS ====================

  async createQuotation(quotation: Quotation): Promise<Quotation> {
    const { resource } = await this.quotationsContainer.items.create(quotation);
    return resource as Quotation;
  }

  async getQuotationById(id: string, leadId: string): Promise<Quotation | null> {
    try {
      const { resource } = await this.quotationsContainer.item(id, leadId).read<Quotation>();
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) return null;
      throw error;
    }
  }

  async getQuotationsByLeadId(leadId: string): Promise<Quotation[]> {
    const query: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE c.leadId = @leadId ORDER BY c.version DESC',
      parameters: [{ name: '@leadId', value: leadId }]
    };
    const { resources } = await this.quotationsContainer.items.query<Quotation>(query).fetchAll();
    return resources;
  }

  async getCurrentQuotation(leadId: string): Promise<Quotation | null> {
    const query: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE c.leadId = @leadId AND c.isCurrentVersion = true',
      parameters: [{ name: '@leadId', value: leadId }]
    };
    const { resources } = await this.quotationsContainer.items.query<Quotation>(query).fetchAll();
    return resources[0] || null;
  }

  async updateQuotation(id: string, leadId: string, updates: Partial<Quotation>): Promise<Quotation> {
    const existing = await this.getQuotationById(id, leadId);
    if (!existing) throw new Error('Quotation not found');

    const updated = { ...existing, ...updates, updatedAt: new Date() };
    const { resource } = await this.quotationsContainer.item(id, leadId).replace(updated);
    return resource as Quotation;
  }

  async markQuotationAsSuperseded(id: string, leadId: string): Promise<Quotation> {
    return this.updateQuotation(id, leadId, {
      status: 'superseded',
      isCurrentVersion: false
    });
  }

  async listQuotations(request: QuotationListRequest): Promise<QuotationListResponse> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', filters = {}, leadId, customerId } = request;

    // Build query
    const conditions: string[] = [];
    const parameters: Array<{ name: string; value: any }> = [];
    let paramIndex = 0;

    if (leadId) {
      conditions.push(`c.leadId = @leadId${paramIndex}`);
      parameters.push({ name: `@leadId${paramIndex}`, value: leadId });
      paramIndex++;
    }

    if (customerId) {
      conditions.push(`c.customerId = @customerId${paramIndex}`);
      parameters.push({ name: `@customerId${paramIndex}`, value: customerId });
      paramIndex++;
    }

    if (filters.status && filters.status.length > 0) {
      conditions.push(`ARRAY_CONTAINS(@statuses${paramIndex}, c.status)`);
      parameters.push({ name: `@statuses${paramIndex}`, value: filters.status });
      paramIndex++;
    }

    if (filters.isCurrentVersion !== undefined) {
      conditions.push(`c.isCurrentVersion = @isCurrentVersion${paramIndex}`);
      parameters.push({ name: `@isCurrentVersion${paramIndex}`, value: filters.isCurrentVersion });
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const orderByClause = `ORDER BY c.${sortBy} ${orderDirection}`;

    // Count query
    const countQuery: SqlQuerySpec = {
      query: `SELECT VALUE COUNT(1) FROM c ${whereClause}`,
      parameters
    };
    const { resources: countResult } = await this.quotationsContainer.items.query(countQuery).fetchAll();
    const totalRecords = countResult[0] || 0;

    // Data query
    const offset = (page - 1) * limit;
    const dataQuery: SqlQuerySpec = {
      query: `SELECT * FROM c ${whereClause} ${orderByClause} OFFSET ${offset} LIMIT ${limit}`,
      parameters
    };
    const { resources: quotations } = await this.quotationsContainer.items.query<Quotation>(dataQuery).fetchAll();

    const totalPages = Math.ceil(totalRecords / limit);

    return {
      data: quotations,
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
          lobs: []
        }
      },
      sort: { sortBy, sortOrder }
    };
  }

  // ==================== QUOTATION PLANS ====================

  async createQuotationPlan(plan: QuotationPlan): Promise<QuotationPlan> {
    const { resource } = await this.quotationPlansContainer.items.create(plan);
    return resource as QuotationPlan;
  }

  async createQuotationPlans(plans: QuotationPlan[]): Promise<QuotationPlan[]> {
    const promises = plans.map(plan => this.createQuotationPlan(plan));
    return Promise.all(promises);
  }

  async getQuotationPlans(quotationId: string): Promise<QuotationPlan[]> {
    const query: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE c.quotationId = @quotationId',
      parameters: [{ name: '@quotationId', value: quotationId }]
    };
    const { resources } = await this.quotationPlansContainer.items.query<QuotationPlan>(query).fetchAll();
    return resources;
  }

  async updateQuotationPlan(id: string, quotationId: string, updates: Partial<QuotationPlan>): Promise<QuotationPlan> {
    try {
      const { resource: existing } = await this.quotationPlansContainer.item(id, quotationId).read<QuotationPlan>();
      if (!existing) throw new Error('Quotation plan not found');

      const updated = { ...existing, ...updates };
      const { resource } = await this.quotationPlansContainer.item(id, quotationId).replace(updated);
      return resource as QuotationPlan;
    } catch (error) {
      throw error;
    }
  }

  // ==================== REVISIONS ====================

  async createRevision(revision: QuotationRevision): Promise<QuotationRevision> {
    const { resource } = await this.revisionsContainer.items.create(revision);
    return resource as QuotationRevision;
  }

  async getRevisionsByQuotation(quotationId: string): Promise<QuotationRevision[]> {
    const query: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE c.quotationId = @quotationId ORDER BY c.version DESC',
      parameters: [{ name: '@quotationId', value: quotationId }]
    };
    const { resources } = await this.revisionsContainer.items.query<QuotationRevision>(query).fetchAll();
    return resources;
  }

  async getRevisionHistory(leadId: string): Promise<QuotationRevision[]> {
    const query: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE c.leadId = @leadId ORDER BY c.version ASC',
      parameters: [{ name: '@leadId', value: leadId }]
    };
    const { resources } = await this.revisionsContainer.items.query<QuotationRevision>(query).fetchAll();
    return resources;
  }
}

export const cosmosService = new CosmosService();


