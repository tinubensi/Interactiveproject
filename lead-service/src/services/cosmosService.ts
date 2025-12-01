/**
 * Cosmos DB Service for Lead Management
 * Handles all database operations for leads, timelines, and stages
 */

import { CosmosClient, Container, Database, SqlQuerySpec } from '@azure/cosmos';
import { Lead, Timeline, Stage, CreateLeadRequest, UpdateLeadRequest, LeadListRequest, LeadListResponse } from '../models/lead';

class CosmosService {
  private client: CosmosClient;
  private database: Database;
  private leadsContainer: Container;
  private timelinesContainer: Container;
  private stagesContainer: Container;

  constructor() {
    const endpoint = process.env.COSMOS_DB_ENDPOINT!;
    const key = process.env.COSMOS_DB_KEY!;
    const databaseName = process.env.COSMOS_DB_NAME || 'LeadDB';

    // Disable SSL verification for Cosmos DB Emulator (local development only)
    if (endpoint.includes('localhost') || endpoint.includes('127.0.0.1')) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    this.client = new CosmosClient({ endpoint, key });
    this.database = this.client.database(databaseName);
    this.leadsContainer = this.database.container('leads');
    this.timelinesContainer = this.database.container('timelines');
    this.stagesContainer = this.database.container('stages');
  }

  /**
   * Initialize database and containers
   */
  async initialize(): Promise<void> {
    try {
      // Create database if not exists
      await this.client.databases.createIfNotExists({ id: process.env.COSMOS_DB_NAME || 'LeadDB' });

      // Create containers if not exist
      await this.database.containers.createIfNotExists({
        id: 'leads',
        partitionKey: { paths: ['/lineOfBusiness'] },
        indexingPolicy: {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [{ path: '/*' }],
          excludedPaths: [{ path: '/_etag/?' }],
          compositeIndexes: [
            [
              { path: '/lineOfBusiness', order: 'ascending' },
              { path: '/createdAt', order: 'descending' }
            ],
            [
              { path: '/lineOfBusiness', order: 'ascending' },
              { path: '/stageId', order: 'ascending' }
            ],
            [
              { path: '/customerId', order: 'ascending' },
              { path: '/createdAt', order: 'descending' }
            ]
          ]
        }
      });

      await this.database.containers.createIfNotExists({
        id: 'timelines',
        partitionKey: { paths: ['/leadId'] }
      });

      await this.database.containers.createIfNotExists({
        id: 'stages',
        partitionKey: { paths: ['/id'] }
      });

      console.log('Cosmos DB initialized successfully');
    } catch (error) {
      console.error('Error initializing Cosmos DB:', error);
      throw error;
    }
  }

  // ==================== LEAD OPERATIONS ====================

  /**
   * Create a new lead
   */
  async createLead(lead: Lead): Promise<Lead> {
    const { resource } = await this.leadsContainer.items.create(lead);
    return resource as Lead;
  }

  /**
   * Get lead by ID
   */
  async getLeadById(id: string, lineOfBusiness: string): Promise<Lead | null> {
    try {
      const { resource } = await this.leadsContainer.item(id, lineOfBusiness).read<Lead>();
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update lead
   */
  async updateLead(id: string, lineOfBusiness: string, updates: Partial<Lead>): Promise<Lead> {
    const lead = await this.getLeadById(id, lineOfBusiness);
    if (!lead) {
      throw new Error('Lead not found');
    }

    const updatedLead = {
      ...lead,
      ...updates,
      updatedAt: new Date()
    };

    const { resource } = await this.leadsContainer.item(id, lineOfBusiness).replace(updatedLead);
    return resource as Lead;
  }

  /**
   * Soft delete lead
   */
  async deleteLead(id: string, lineOfBusiness: string): Promise<Lead> {
    return this.updateLead(id, lineOfBusiness, {
      deletedAt: new Date()
    });
  }

  /**
   * Check if email or phone is repeated
   */
  async checkRepeatedContact(email: string, phone: string): Promise<{ isEmailRepeated: boolean; isPhoneRepeated: boolean }> {
    let isEmailRepeated = false;
    let isPhoneRepeated = false;

    // Check email
    if (email) {
      const emailQuery: SqlQuerySpec = {
        query: 'SELECT VALUE COUNT(1) FROM c WHERE c.email = @email AND NOT IS_DEFINED(c.deletedAt)',
        parameters: [{ name: '@email', value: email }]
      };
      const { resources: emailCount } = await this.leadsContainer.items.query(emailQuery).fetchAll();
      isEmailRepeated = emailCount[0] > 0;
    }

    // Check phone
    if (phone) {
      const phoneQuery: SqlQuerySpec = {
        query: 'SELECT VALUE COUNT(1) FROM c WHERE c.phone.number = @phone AND NOT IS_DEFINED(c.deletedAt)',
        parameters: [{ name: '@phone', value: phone }]
      };
      const { resources: phoneCount } = await this.leadsContainer.items.query(phoneQuery).fetchAll();
      isPhoneRepeated = phoneCount[0] > 0;
    }

    return { isEmailRepeated, isPhoneRepeated };
  }

  /**
   * List leads with pagination, filtering, and sorting
   * Reference: Petli getLeads function
   */
  async listLeads(request: LeadListRequest): Promise<LeadListResponse> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      filters = {}
    } = request;

    // Build query conditions
    const conditions: string[] = [
      'c.type = "lead"',
      'NOT IS_DEFINED(c.deletedAt)'
    ];
    const parameters: Array<{ name: string; value: any }> = [];
    let paramIndex = 0;

    // Line of Business filter
    if (filters.lineOfBusiness && filters.lineOfBusiness.length > 0) {
      const paramName = `@lob${paramIndex++}`;
      conditions.push(`ARRAY_CONTAINS(${paramName}, c.lineOfBusiness)`);
      parameters.push({ name: paramName, value: filters.lineOfBusiness });
    }

    // Business Type filter
    if (filters.businessType && filters.businessType.length > 0) {
      const paramName = `@businessType${paramIndex++}`;
      conditions.push(`ARRAY_CONTAINS(${paramName}, c.businessType)`);
      parameters.push({ name: paramName, value: filters.businessType });
    }

    // Stage filter
    if (filters.stageId && filters.stageId.length > 0) {
      const paramName = `@stageId${paramIndex++}`;
      conditions.push(`ARRAY_CONTAINS(${paramName}, c.stageId)`);
      parameters.push({ name: paramName, value: filters.stageId });
    }

    // Assigned To filter
    if (filters.assignedTo && filters.assignedTo.length > 0) {
      const paramName = `@assignedTo${paramIndex++}`;
      conditions.push(`ARRAY_CONTAINS(${paramName}, c.assignedTo)`);
      parameters.push({ name: paramName, value: filters.assignedTo });
    }

    // Customer filter
    if (filters.customerId) {
      const paramName = `@customerId${paramIndex++}`;
      conditions.push(`c.customerId = ${paramName}`);
      parameters.push({ name: paramName, value: filters.customerId });
    }

    // Hot Lead filter
    if (filters.isHotLead !== undefined) {
      const paramName = `@isHotLead${paramIndex++}`;
      conditions.push(`c.isHotLead = ${paramName}`);
      parameters.push({ name: paramName, value: filters.isHotLead });
    }

    // Date range filters
    if (filters.createdFrom) {
      const paramName = `@createdFrom${paramIndex++}`;
      conditions.push(`c.createdAt >= ${paramName}`);
      parameters.push({ name: paramName, value: filters.createdFrom });
    }

    if (filters.createdTo) {
      const paramName = `@createdTo${paramIndex++}`;
      conditions.push(`c.createdAt <= ${paramName}`);
      parameters.push({ name: paramName, value: filters.createdTo });
    }

    // Global search (searches multiple fields)
    if (search && search.trim()) {
      const searchParam = `@search${paramIndex++}`;
      const searchConditions = [
        `CONTAINS(LOWER(c.firstName), LOWER(${searchParam}))`,
        `CONTAINS(LOWER(c.lastName), LOWER(${searchParam}))`,
        `CONTAINS(LOWER(c.email), LOWER(${searchParam}))`,
        `CONTAINS(LOWER(c.phone.number), LOWER(${searchParam}))`,
        `CONTAINS(LOWER(c.referenceId), LOWER(${searchParam}))`
      ];
      conditions.push(`(${searchConditions.join(' OR ')})`);
      parameters.push({ name: searchParam, value: search.trim() });
    }

    // Build WHERE clause
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Build ORDER BY clause
    const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const orderByClause = `ORDER BY c.${sortBy} ${orderDirection}`;

    // Count query
    const countQuery: SqlQuerySpec = {
      query: `SELECT VALUE COUNT(1) FROM c ${whereClause}`,
      parameters
    };

    const { resources: countResult } = await this.leadsContainer.items.query(countQuery).fetchAll();
    const totalRecords = countResult[0] || 0;

    // Data query with pagination
    const offset = (page - 1) * limit;
    const dataQuery: SqlQuerySpec = {
      query: `SELECT * FROM c ${whereClause} ${orderByClause} OFFSET ${offset} LIMIT ${limit}`,
      parameters
    };

    const { resources: leads } = await this.leadsContainer.items.query<Lead>(dataQuery).fetchAll();

    // Calculate pagination
    const totalPages = Math.ceil(totalRecords / limit);
    const hasNext = page < totalPages;
    const hasPrevious = page > 1;

    return {
      data: leads,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
        hasNext,
        hasPrevious
      },
      filters: {
        applied: filters,
        available: await this.getAvailableFilters()
      },
      sort: {
        sortBy,
        sortOrder
      }
    };
  }

  /**
   * Get available filter options
   */
  private async getAvailableFilters(): Promise<any> {
    // Get unique LOBs
    const lobQuery: SqlQuerySpec = {
      query: 'SELECT DISTINCT VALUE c.lineOfBusiness FROM c WHERE c.type = "lead" AND NOT IS_DEFINED(c.deletedAt)'
    };
    const { resources: lobs } = await this.leadsContainer.items.query(lobQuery).fetchAll();

    // Get stages
    const stages = await this.getAllStages();

    return {
      lineOfBusiness: lobs.map((lob: string) => ({
        value: lob,
        label: this.formatLOBLabel(lob),
        count: 0
      })),
      stages: stages.map(stage => ({
        id: stage.id,
        name: stage.name,
        count: 0
      })),
      emirates: [], // TODO: Fetch from metadata
      sources: []
    };
  }

  private formatLOBLabel(lob: string): string {
    const labels: Record<string, string> = {
      medical: 'Medical/Pet Insurance',
      motor: 'Motor Insurance',
      general: 'General Insurance',
      marine: 'Marine Insurance'
    };
    return labels[lob] || lob;
  }

  // ==================== TIMELINE OPERATIONS ====================

  /**
   * Create timeline entry
   * Reference: Petli addTimelineHistory function
   */
  async createTimelineEntry(timeline: Timeline): Promise<Timeline> {
    const { resource } = await this.timelinesContainer.items.create(timeline);
    return resource as Timeline;
  }

  /**
   * Get timeline for a lead
   */
  async getLeadTimeline(leadId: string): Promise<Timeline[]> {
    const query: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE c.leadId = @leadId ORDER BY c.timestamp DESC',
      parameters: [{ name: '@leadId', value: leadId }]
    };

    const { resources } = await this.timelinesContainer.items.query<Timeline>(query).fetchAll();
    return resources;
  }

  // ==================== STAGE OPERATIONS ====================

  /**
   * Get all stages
   */
  async getAllStages(): Promise<Stage[]> {
    const query = 'SELECT * FROM c WHERE c.isActive = true ORDER BY c["order"] ASC';
    const { resources } = await this.stagesContainer.items.query<Stage>(query).fetchAll();
    return resources;
  }

  /**
   * Get stages for specific LOB
   */
  async getStagesByLOB(lineOfBusiness: string): Promise<Stage[]> {
    const query: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE c.isActive = true AND ARRAY_CONTAINS(c.applicableFor, @lob) ORDER BY c["order"] ASC',
      parameters: [{ name: '@lob', value: lineOfBusiness }]
    };

    const { resources } = await this.stagesContainer.items.query<Stage>(query).fetchAll();
    return resources;
  }

  /**
   * Get stage by ID
   */
  async getStageById(id: number): Promise<Stage | null> {
    try {
      const { resource } = await this.stagesContainer.item(id.toString(), id).read<Stage>();
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Seed initial stages
   */
  async seedStages(): Promise<void> {
    const stages: Stage[] = [
      { id: 'stage-1', name: 'New Lead', order: 1, applicableFor: ['medical', 'motor', 'general', 'marine'], isActive: true },
      { id: 'stage-2', name: 'Plans Available', order: 2, applicableFor: ['medical', 'motor', 'general', 'marine'], isActive: true },
      { id: 'stage-3', name: 'Quotation Created', order: 3, applicableFor: ['medical', 'motor', 'general', 'marine'], isActive: true },
      { id: 'stage-4', name: 'Quotation Sent', order: 4, applicableFor: ['medical', 'motor', 'general', 'marine'], isActive: true },
      { id: 'stage-5', name: 'Pending Review', order: 5, applicableFor: ['medical', 'motor', 'general', 'marine'], isActive: true },
      { id: 'stage-6', name: 'Policy Issued', order: 6, applicableFor: ['medical', 'motor', 'general', 'marine'], isActive: true },
      { id: 'stage-7', name: 'Rejected', order: 7, applicableFor: ['medical', 'motor', 'general', 'marine'], isActive: true },
      { id: 'stage-8', name: 'Lost', order: 8, applicableFor: ['medical', 'motor', 'general', 'marine'], isActive: true }
    ];

    for (const stage of stages) {
      try {
        await this.stagesContainer.items.upsert(stage);
      } catch (error) {
        console.error(`Error seeding stage ${stage.name}:`, error);
      }
    }

    console.log('Stages seeded successfully');
  }
}

export const cosmosService = new CosmosService();

