/**
 * Cosmos DB Service for Lead Management
 * Handles all database operations for leads, timelines, and stages
 */

import { CosmosClient, Container, Database, SqlQuerySpec, SqlParameter } from '@azure/cosmos';
import { Lead, Timeline, Stage, CreateLeadRequest, UpdateLeadRequest, LeadListRequest, LeadListResponse } from '../models/lead';
import axios from 'axios';

// Plan interface (matches quotation-generation-service)
export interface Plan {
  id: string;
  leadId: string;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  planName: string;
  planCode: string;
  planType: string;
  annualPremium: number;
  monthlyPremium: number;
  currency: string;
  annualLimit: number;
  deductible: number;
  deductibleMetric?: string;
  coInsurance: number;
  coInsuranceMetric?: string;
  waitingPeriod: number;
  waitingPeriodMetric?: string;
  benefits?: any[];
  exclusions?: string[];
  addons?: any[];
  lineOfBusiness: string;
  lobSpecificData?: any;
  isAvailable: boolean;
  isSelected: boolean;
  isRecommended: boolean;
  fetchRequestId?: string;
  fetchedAt?: Date;
  source?: string;
  quotationId?: string;
  rawPlanData?: any;
}

// VendorExecution interface for RPA diagnostic and error tracking
export interface VendorExecution {
  id: string;
  leadId: string; // partition key
  vendorId: string;
  executionType: 'diagnostic' | 'error';
  stage?: string; // for diagnostics: parsing, credentials, browser_launch, etc.
  status: 'success' | 'failed' | 'timeout' | 'started' | 'completed';
  message: string;
  details?: Record<string, any>;
  error?: string;
  traceback?: string;
  timestamp: string;
}

class CosmosService {
  private client: CosmosClient;
  private database: Database;
  private leadsContainer: Container;
  private timelinesContainer: Container;
  private stagesContainer: Container;
  private plansContainer: Container;
  private vendorExecutionsContainer: Container;

  constructor() {
    // Support both connection string (Azure) and separate endpoint/key (emulator)
    const connectionString = process.env.COSMOS_CONNECTION_STRING;
    const endpoint = process.env.COSMOS_DB_ENDPOINT;
    const key = process.env.COSMOS_DB_KEY;
    const databaseName = process.env.COSMOS_DB_NAME || 'lead-service-db';

    if (connectionString) {
      // Using Azure Cosmos DB (production/cloud)
      this.client = new CosmosClient(connectionString);
    } else if (endpoint && key) {
      // Using emulator with separate endpoint/key
      if (endpoint && (endpoint.includes('localhost') || endpoint.includes('127.0.0.1'))) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      }
      this.client = new CosmosClient({ endpoint, key });
    } else {
      throw new Error('COSMOS_CONNECTION_STRING or (COSMOS_DB_ENDPOINT + COSMOS_DB_KEY) must be set');
    }

    this.database = this.client.database(databaseName);
    this.leadsContainer = this.database.container('leads');
    this.timelinesContainer = this.database.container('timelines');
    this.stagesContainer = this.database.container('stages');
    this.plansContainer = this.database.container('plans');
    this.vendorExecutionsContainer = this.database.container('vendorExecutions');
  }

  /**
   * Initialize database and containers
   */
  async initialize(): Promise<void> {
    try {
      // Create database if not exists
      await this.client.databases.createIfNotExists({ id: process.env.COSMOS_DB_NAME || 'lead-service-db' });

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

      await this.database.containers.createIfNotExists({
        id: 'plans',
        partitionKey: { paths: ['/leadId'] },
        indexingPolicy: {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [{ path: '/*' }],
          excludedPaths: [{ path: '/_etag/?' }]
        }
      });

      await this.database.containers.createIfNotExists({
        id: 'vendorExecutions',
        partitionKey: { paths: ['/leadId'] },
        indexingPolicy: {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [{ path: '/*' }],
          excludedPaths: [{ path: '/_etag/?' }],
          compositeIndexes: [
            [
              { path: '/leadId', order: 'ascending' },
              { path: '/timestamp', order: 'descending' }
            ],
            [
              { path: '/vendorId', order: 'ascending' },
              { path: '/timestamp', order: 'descending' }
            ]
          ]
        }
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
   * Note: RPA triggering is handled by createLead.ts function, not here
   */
  async createLead(lead: Lead): Promise<Lead> {
    const { resource } = await this.leadsContainer.items.create(lead);
    const createdLead = resource as Lead;
    
    // ✅ RPA is triggered from createLead.ts function (not here)
    // This prevents duplicate RPA triggers
    
    return createdLead;
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
   * Get lead by ID without partition key (cross-partition query)
   * Used when lineOfBusiness is not known
   */
  async getLeadByIdWithoutPartition(id: string): Promise<Lead | null> {
    try {
      const query: SqlQuerySpec = {
        query: 'SELECT * FROM c WHERE c.id = @id AND c.type = @type AND NOT IS_DEFINED(c.deletedAt)',
        parameters: [
          { name: '@id', value: id },
          { name: '@type', value: 'lead' }
        ]
      };
      const { resources } = await this.leadsContainer.items.query<Lead>(query).fetchAll();
      return resources.length > 0 ? resources[0] : null;
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
  async updateLead(id: string, lineOfBusiness: string, updates: Partial<Lead>, etag?: string): Promise<Lead> {
    // Get existing lead
    let lead = await this.getLeadById(id, lineOfBusiness);
    if (!lead) {
      throw new Error('Lead not found');
    }

    // Store the ETag from the lead (or use provided etag)
    let currentEtag = etag || (lead as any)._etag;

    // CRITICAL: Ensure the id field matches (Cosmos DB requires exact match)
    const updatedLead = {
      ...lead,
      ...updates,
      id: lead.id, // Ensure id is preserved and matches
      updatedAt: new Date()
    };

    // Try to replace with retry logic for Cosmos DB consistency and ETag optimistic concurrency
    let lastError: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // Use ETag-based optimistic concurrency if ETag is available
        const replaceOptions: any = {};
        if (currentEtag) {
          replaceOptions.accessCondition = {
            type: 'IfMatch',
            condition: currentEtag
          };
        }

        const { resource } = await this.leadsContainer.item(lead.id, lineOfBusiness).replace(updatedLead, replaceOptions);
        if (!resource) {
          throw new Error('Replace operation returned no resource');
        }
        return resource as unknown as Lead;
      } catch (error: any) {
        lastError = error;
        
        // Handle ETag mismatch (409 Conflict or 412 Precondition Failed)
        // This indicates the lead was modified by another process
        if ((error.code === 409 || error.code === 412 || error.statusCode === 409 || error.statusCode === 412) && attempt < 3) {
          // Wait a bit for consistency
          await new Promise(resolve => setTimeout(resolve, 300 * attempt));
          
          // Refresh the lead to get latest _etag and data
          const refreshedLead = await this.getLeadById(id, lineOfBusiness);
          if (refreshedLead) {
            lead = refreshedLead;
            currentEtag = (refreshedLead as any)._etag;
            // Update the lead object with latest data
            Object.assign(updatedLead, {
              ...refreshedLead,
              ...updates,
              id: refreshedLead.id,
              updatedAt: new Date()
            });
            continue; // Retry with refreshed lead and new ETag
          }
        }
        
        // If 404, retry after refreshing the lead
        if (error.code === 404 && attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 300 * attempt));
          const refreshedLead = await this.getLeadById(id, lineOfBusiness);
          if (refreshedLead) {
            lead = refreshedLead;
            currentEtag = (refreshedLead as any)._etag;
            Object.assign(updatedLead, {
              ...refreshedLead,
              ...updates,
              id: refreshedLead.id,
              updatedAt: new Date()
            });
            continue;
          }
        }
        
        // For other errors or final attempt, throw
        if (attempt === 3) {
          throw new Error(`Failed to update lead after ${attempt} attempts: ${error.message || String(error)}`);
        }
      }
    }
    
    throw lastError || new Error('Failed to update lead');
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
   * 
   * Filtering Behavior:
   * - currentStage: Filters leads by stage name(s). Common use case is to show only
   *   active leads (e.g., "Lead Created", "Plans Fetching", "Plans Available", "Revision Requested")
   *   and exclude leads that have moved to quotations.
   * - excludeWithQuotation: When true (default), excludes leads that have a quotationId defined.
   *   This prevents leads that have progressed to quotations from appearing in leads listings.
   *   Set to false to include all leads regardless of quotation status.
   * 
   * Default Behavior for Lead Listings:
   * - Frontend should pass currentStage filter with active stages
   * - Backend automatically excludes leads with quotationId (unless explicitly included)
   * - This ensures proper separation between Leads listing and Quotations listing
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

    // Current Stage filter (string-based)
    if (filters.currentStage && filters.currentStage.length > 0) {
      const paramName = `@currentStage${paramIndex++}`;
      conditions.push(`ARRAY_CONTAINS(${paramName}, c.currentStage)`);
      parameters.push({ name: paramName, value: filters.currentStage });
    }

    // Exclude leads with quotationId (they belong in Quotations listing)
    // Default behavior is to exclude, can be overridden by setting excludeWithQuotation to false
    if (filters.excludeWithQuotation !== false) { // Default: exclude
      conditions.push('NOT IS_DEFINED(c.quotationId)');
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

    // Cross-partition queries are enabled by default in SDK v4
    const { resources: countResult } = await this.leadsContainer.items.query(countQuery).fetchAll();
    const totalRecords = countResult[0] || 0;

    // Data query with pagination
    // Note: ORDER BY with cross-partition queries can be slow, but it's required for sorting
    const offset = (page - 1) * limit;
    const dataQuery: SqlQuerySpec = {
      query: `SELECT * FROM c ${whereClause} ${orderByClause} OFFSET ${offset} LIMIT ${limit}`,
      parameters
    };

    // Execute query with timeout handling
    const queryIterator = this.leadsContainer.items.query<Lead>(dataQuery);
    const { resources: leads } = await queryIterator.fetchAll();

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
   * Includes duplicate check to prevent race conditions
   */
  async createTimelineEntry(timeline: Timeline): Promise<Timeline> {
    // Quick check for recent duplicate entry (best effort - may not catch all race conditions)
    // This is an additional safety net; primary deduplication happens in updateStageInternal
    try {
      const recentEntries = await this.getTimelineEntries(timeline.leadId, {
        limit: 1,
        orderBy: 'timestamp',
        order: 'desc',
        stage: timeline.stage,
        stageId: timeline.stageId,
        since: new Date(Date.now() - 10 * 1000) // Check last 10 seconds
      });

      if (recentEntries.length > 0) {
        const mostRecent = recentEntries[0];
        const timeDiff = Date.now() - new Date(mostRecent.timestamp).getTime();
        // If duplicate found within 10 seconds with same changedBy, skip creation
        if (timeDiff < 10 * 1000 && mostRecent.changedBy === timeline.changedBy) {
          // Return existing entry instead of creating duplicate
          return mostRecent;
        }
      }
    } catch (checkError) {
      // Log but don't fail - this is a best-effort check
      // Primary deduplication happens in updateStageInternal
      console.warn('Failed to check for duplicate timeline entry:', checkError);
    }

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

  /**
   * Get timeline entries for a lead with optional filters
   */
  async getTimelineEntries(
    leadId: string,
    options?: {
      limit?: number;
      orderBy?: 'timestamp';
      order?: 'asc' | 'desc';
      stage?: string;
      stageId?: string;
      since?: Date;
    }
  ): Promise<Timeline[]> {
    const limit = options?.limit || 100;
    const order = options?.order || 'desc';
    const orderBy = options?.orderBy || 'timestamp';
    
    let query = 'SELECT * FROM c WHERE c.leadId = @leadId';
    const parameters: SqlParameter[] = [
      { name: '@leadId', value: leadId }
    ];
    
    // Add stage filter
    if (options?.stage) {
      query += ' AND c.stage = @stage';
      parameters.push({ name: '@stage', value: options.stage });
    }
    
    // Add stageId filter
    if (options?.stageId) {
      query += ' AND c.stageId = @stageId';
      parameters.push({ name: '@stageId', value: options.stageId });
    }
    
    // Add timestamp filter (since)
    if (options?.since) {
      query += ' AND c.timestamp >= @since';
      parameters.push({ name: '@since', value: options.since.toISOString() });
    }
    
    // Add ordering
    query += ` ORDER BY c.${orderBy} ${order.toUpperCase()}`;
    
    // Add limit (Cosmos DB uses TOP)
    query = query.replace('SELECT *', `SELECT TOP ${limit} *`);
    
    const querySpec: SqlQuerySpec = {
      query,
      parameters
    };
    
    const { resources } = await this.timelinesContainer.items.query<Timeline>(querySpec).fetchAll();
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
      { id: 'stage-1', name: 'Plans Fetching', order: 1, applicableFor: ['medical', 'motor', 'general', 'marine'], isActive: true },
      { id: 'stage-1-failed', name: 'Plans Fetch Failed', order: 1.5, applicableFor: ['medical', 'motor', 'general', 'marine'], isActive: true },
      { id: 'stage-2', name: 'Plans Available', order: 2, applicableFor: ['medical', 'motor', 'general', 'marine'], isActive: true },
      { id: 'stage-3', name: 'Quotation Created', order: 3, applicableFor: ['medical', 'motor', 'general', 'marine'], isActive: true },
      { id: 'stage-4', name: 'Quotation Sent', order: 4, applicableFor: ['medical', 'motor', 'general', 'marine'], isActive: true },
      { id: 'stage-9', name: 'Revision Requested', order: 5.5, applicableFor: ['medical', 'motor', 'general', 'marine'], isActive: true },
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

  // ==================== PLAN OPERATIONS ====================

  /**
   * Create a single plan
   */
  async createPlan(plan: Plan): Promise<Plan> {
    const { resource } = await this.plansContainer.items.create(plan);
    return resource as Plan;
  }

  /**
   * Create multiple plans
   */
  async createPlans(plans: Plan[]): Promise<Plan[]> {
    const createdPlans: Plan[] = [];
    for (const plan of plans) {
      try {
        console.log(`Creating plan ${plan.id} with leadId: ${plan.leadId}`);
        const created = await this.createPlan(plan);
        createdPlans.push(created);
        console.log(`Successfully created plan ${created.id}`);
      } catch (error: any) {
        console.error(`Error creating plan ${plan.id}:`, error);
        console.error(`Plan data:`, JSON.stringify({id: plan.id, leadId: plan.leadId, vendorName: plan.vendorName}));
      }
    }
    return createdPlans;
  }

  /**
   * Get all plans for a lead
   * Filters out RPA diagnostic and error documents
   */
  async getPlansForLead(leadId: string): Promise<Plan[]> {
    const query: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE c.leadId = @leadId AND c.type = @type ORDER BY c.annualPremium ASC',
      parameters: [
        { name: '@leadId', value: leadId },
        { name: '@type', value: 'plan' }
      ]
    };

    const { resources } = await this.plansContainer.items.query<Plan>(query).fetchAll();
    return resources;
  }

  /**
   * Get plan by ID
   */
  async getPlanById(id: string, leadId: string): Promise<Plan | null> {
    try {
      const { resource } = await this.plansContainer.item(id, leadId).read<Plan>();
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update a plan
   */
  async updatePlan(id: string, leadId: string, updates: Partial<Plan>): Promise<Plan> {
    const plan = await this.getPlanById(id, leadId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    const updatedPlan = {
      ...plan,
      ...updates
    };

    const { resource } = await this.plansContainer.item(id, leadId).replace(updatedPlan);
    return resource as Plan;
  }

  /**
   * Delete all plans for a lead (for re-fetching)
   * Only deletes actual plans (type="plan"), not RPA diagnostics or errors
   */
  async deletePlansForLead(leadId: string): Promise<void> {
    const plans = await this.getPlansForLead(leadId);
    for (const plan of plans) {
      try {
        await this.plansContainer.item(plan.id, leadId).delete();
      } catch (error) {
        console.error(`Error deleting plan ${plan.id}:`, error);
      }
    }
  }

  /**
   * Get plans count for a lead
   * Only counts actual plans, not RPA diagnostics or errors
   */
  async getPlansCountForLead(leadId: string): Promise<number> {
    const query: SqlQuerySpec = {
      query: 'SELECT VALUE COUNT(1) FROM c WHERE c.leadId = @leadId AND c.type = @type',
      parameters: [
        { name: '@leadId', value: leadId },
        { name: '@type', value: 'plan' }
      ]
    };

    const { resources } = await this.plansContainer.items.query(query).fetchAll();
    return resources[0] || 0;
  }

  // ==================== VENDOR EXECUTIONS ====================

  /**
   * Create a vendor execution record (RPA diagnostic or error)
   */
  async createVendorExecution(execution: VendorExecution): Promise<VendorExecution> {
    const { resource } = await this.vendorExecutionsContainer.items.create(execution);
    return resource as VendorExecution;
  }

  /**
   * Get all vendor executions for a lead
   */
  async getVendorExecutionsForLead(leadId: string): Promise<VendorExecution[]> {
    const query: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE c.leadId = @leadId ORDER BY c.timestamp DESC',
      parameters: [{ name: '@leadId', value: leadId }]
    };

    const { resources } = await this.vendorExecutionsContainer.items.query<VendorExecution>(query).fetchAll();
    return resources;
  }

  /**
   * Get vendor executions for a specific vendor and lead
   */
  async getVendorExecutionsByVendor(leadId: string, vendorId: string): Promise<VendorExecution[]> {
    const query: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE c.leadId = @leadId AND c.vendorId = @vendorId ORDER BY c.timestamp DESC',
      parameters: [
        { name: '@leadId', value: leadId },
        { name: '@vendorId', value: vendorId }
      ]
    };

    const { resources } = await this.vendorExecutionsContainer.items.query<VendorExecution>(query).fetchAll();
    return resources;
  }

  /**
   * Get vendor executions by type (diagnostic or error)
   */
  async getVendorExecutionsByType(leadId: string, executionType: 'diagnostic' | 'error'): Promise<VendorExecution[]> {
    const query: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE c.leadId = @leadId AND c.executionType = @executionType ORDER BY c.timestamp DESC',
      parameters: [
        { name: '@leadId', value: leadId },
        { name: '@executionType', value: executionType }
      ]
    };

    const { resources } = await this.vendorExecutionsContainer.items.query<VendorExecution>(query).fetchAll();
    return resources;
  }
}

export const cosmosService = new CosmosService();

