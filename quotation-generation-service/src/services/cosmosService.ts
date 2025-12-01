/**
 * Cosmos DB Service for Quotation Generation
 * Handles all database operations for plans, filters, comparisons
 */

import { CosmosClient, Container, Database, SqlQuerySpec } from '@azure/cosmos';
import { Plan, PlanFetchRequest, PlanFilter, PlanComparison, Vendor, PlanListRequest, PlanListResponse } from '../models/plan';

class CosmosService {
  private client: CosmosClient;
  private database: Database;
  private fetchRequestsContainer: Container;
  private plansContainer: Container;
  private planFiltersContainer: Container;
  private planComparisonsContainer: Container;
  private vendorsContainer: Container;

  constructor() {
    const endpoint = process.env.COSMOS_DB_ENDPOINT!;
    const key = process.env.COSMOS_DB_KEY!;
    const databaseName = process.env.COSMOS_DB_NAME || 'PlanDB';

    this.client = new CosmosClient({ endpoint, key });
    this.database = this.client.database(databaseName);
    this.fetchRequestsContainer = this.database.container('fetchRequests');
    this.plansContainer = this.database.container('plans');
    this.planFiltersContainer = this.database.container('planFilters');
    this.planComparisonsContainer = this.database.container('planComparisons');
    this.vendorsContainer = this.database.container('vendors');
  }

  async initialize(): Promise<void> {
    try {
      await this.client.databases.createIfNotExists({ id: process.env.COSMOS_DB_NAME || 'PlanDB' });

      await this.database.containers.createIfNotExists({
        id: 'fetchRequests',
        partitionKey: { paths: ['/leadId'] }
      });

      await this.database.containers.createIfNotExists({
        id: 'plans',
        partitionKey: { paths: ['/leadId'] },
        indexingPolicy: {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [{ path: '/*' }],
          compositeIndexes: [
            [
              { path: '/leadId', order: 'ascending' },
              { path: '/annualPremium', order: 'ascending' }
            ]
          ]
        }
      });

      await this.database.containers.createIfNotExists({
        id: 'planFilters',
        partitionKey: { paths: ['/leadId'] }
      });

      await this.database.containers.createIfNotExists({
        id: 'planComparisons',
        partitionKey: { paths: ['/leadId'] }
      });

      await this.database.containers.createIfNotExists({
        id: 'vendors',
        partitionKey: { paths: ['/lineOfBusiness'] }
      });

      console.log('PlanDB initialized successfully');
    } catch (error) {
      console.error('Error initializing Cosmos DB:', error);
      throw error;
    }
  }

  // ==================== FETCH REQUESTS ====================

  async createFetchRequest(request: PlanFetchRequest): Promise<PlanFetchRequest> {
    const { resource } = await this.fetchRequestsContainer.items.create(request);
    return resource as PlanFetchRequest;
  }

  async getFetchRequest(id: string, leadId: string): Promise<PlanFetchRequest | null> {
    try {
      const { resource } = await this.fetchRequestsContainer.item(id, leadId).read<PlanFetchRequest>();
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) return null;
      throw error;
    }
  }

  async updateFetchRequest(id: string, leadId: string, updates: Partial<PlanFetchRequest>): Promise<PlanFetchRequest> {
    const existing = await this.getFetchRequest(id, leadId);
    if (!existing) throw new Error('Fetch request not found');

    const updated = { ...existing, ...updates };
    const { resource } = await this.fetchRequestsContainer.item(id, leadId).replace(updated);
    return resource as PlanFetchRequest;
  }

  // ==================== PLANS ====================

  async createPlan(plan: Plan): Promise<Plan> {
    const { resource } = await this.plansContainer.items.create(plan);
    return resource as Plan;
  }

  async createPlans(plans: Plan[]): Promise<Plan[]> {
    const promises = plans.map(plan => this.createPlan(plan));
    return Promise.all(promises);
  }

  async getPlanById(id: string, leadId: string): Promise<Plan | null> {
    try {
      const { resource } = await this.plansContainer.item(id, leadId).read<Plan>();
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) return null;
      throw error;
    }
  }

  async getPlansForLead(leadId: string): Promise<Plan[]> {
    const query: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE c.leadId = @leadId ORDER BY c.annualPremium ASC',
      parameters: [{ name: '@leadId', value: leadId }]
    };
    const { resources } = await this.plansContainer.items.query<Plan>(query).fetchAll();
    return resources;
  }

  async listPlans(request: PlanListRequest): Promise<PlanListResponse> {
    const { leadId, page = 1, limit = 20, sortBy = 'annualPremium', sortOrder = 'asc', filters = {} } = request;

    // Build query
    const conditions: string[] = ['c.leadId = @leadId'];
    const parameters: Array<{ name: string; value: any }> = [{ name: '@leadId', value: leadId }];
    let paramIndex = 0;

    if (filters.isAvailable !== undefined) {
      conditions.push(`c.isAvailable = @isAvailable${paramIndex}`);
      parameters.push({ name: `@isAvailable${paramIndex}`, value: filters.isAvailable });
      paramIndex++;
    }

    if (filters.vendorIds && filters.vendorIds.length > 0) {
      conditions.push(`ARRAY_CONTAINS(@vendorIds${paramIndex}, c.vendorId)`);
      parameters.push({ name: `@vendorIds${paramIndex}`, value: filters.vendorIds });
      paramIndex++;
    }

    if (filters.annualPremium) {
      if (filters.annualPremium.min !== undefined) {
        conditions.push(`c.annualPremium >= @premiumMin${paramIndex}`);
        parameters.push({ name: `@premiumMin${paramIndex}`, value: filters.annualPremium.min });
        paramIndex++;
      }
      if (filters.annualPremium.max !== undefined) {
        conditions.push(`c.annualPremium <= @premiumMax${paramIndex}`);
        parameters.push({ name: `@premiumMax${paramIndex}`, value: filters.annualPremium.max });
        paramIndex++;
      }
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const orderByClause = `ORDER BY c.${sortBy} ${orderDirection}`;

    // Count query
    const countQuery: SqlQuerySpec = {
      query: `SELECT VALUE COUNT(1) FROM c ${whereClause}`,
      parameters
    };
    const { resources: countResult } = await this.plansContainer.items.query(countQuery).fetchAll();
    const totalRecords = countResult[0] || 0;

    // Data query
    const offset = (page - 1) * limit;
    const dataQuery: SqlQuerySpec = {
      query: `SELECT * FROM c ${whereClause} ${orderByClause} OFFSET ${offset} LIMIT ${limit}`,
      parameters
    };
    const { resources: plans } = await this.plansContainer.items.query<Plan>(dataQuery).fetchAll();

    const totalPages = Math.ceil(totalRecords / limit);

    return {
      data: plans,
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
        available: await this.getAvailableFilters(leadId)
      },
      sort: { sortBy, sortOrder }
    };
  }

  private async getAvailableFilters(leadId: string): Promise<any> {
    const plans = await this.getPlansForLead(leadId);
    
    const vendors = Array.from(new Set(plans.map(p => p.vendorId))).map(vendorId => {
      const vendorPlans = plans.filter(p => p.vendorId === vendorId);
      return {
        id: vendorId,
        name: vendorPlans[0].vendorName,
        count: vendorPlans.length,
        avgPremium: vendorPlans.reduce((sum, p) => sum + p.annualPremium, 0) / vendorPlans.length
      };
    });

    const premiums = plans.map(p => p.annualPremium);

    return {
      vendors,
      planTypes: [],
      priceRanges: {
        minPremium: Math.min(...premiums),
        maxPremium: Math.max(...premiums),
        avgPremium: premiums.reduce((a, b) => a + b, 0) / premiums.length
      },
      coverageRanges: {
        minAnnualLimit: Math.min(...plans.map(p => p.annualLimit)),
        maxAnnualLimit: Math.max(...plans.map(p => p.annualLimit)),
        minDeductible: Math.min(...plans.map(p => p.deductible)),
        maxDeductible: Math.max(...plans.map(p => p.deductible))
      }
    };
  }

  async updatePlan(id: string, leadId: string, updates: Partial<Plan>): Promise<Plan> {
    const existing = await this.getPlanById(id, leadId);
    if (!existing) throw new Error('Plan not found');

    const updated = { ...existing, ...updates };
    const { resource } = await this.plansContainer.item(id, leadId).replace(updated);
    return resource as Plan;
  }

  async selectPlans(leadId: string, planIds: string[]): Promise<Plan[]> {
    // First, unselect all plans for this lead
    const allPlans = await this.getPlansForLead(leadId);
    for (const plan of allPlans) {
      if (plan.isSelected) {
        await this.updatePlan(plan.id, leadId, { isSelected: false });
      }
    }

    // Select specified plans
    const selectedPlans: Plan[] = [];
    for (const planId of planIds) {
      const plan = await this.updatePlan(planId, leadId, { isSelected: true });
      selectedPlans.push(plan);
    }

    return selectedPlans;
  }

  // ==================== FILTERS ====================

  async saveFilter(filter: PlanFilter): Promise<PlanFilter> {
    const { resource } = await this.planFiltersContainer.items.upsert(filter);
    return resource as unknown as PlanFilter;
  }

  async getFilter(leadId: string): Promise<PlanFilter | null> {
    const query: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE c.leadId = @leadId',
      parameters: [{ name: '@leadId', value: leadId }]
    };
    const { resources } = await this.planFiltersContainer.items.query<PlanFilter>(query).fetchAll();
    return resources.length > 0 ? (resources[0] as unknown as PlanFilter) : null;
  }

  async deleteFilter(id: string, leadId: string): Promise<void> {
    await this.planFiltersContainer.item(id, leadId).delete();
  }

  // ==================== COMPARISONS ====================

  async createComparison(comparison: PlanComparison): Promise<PlanComparison> {
    const { resource } = await this.planComparisonsContainer.items.create(comparison);
    return resource as PlanComparison;
  }

  async getComparison(id: string, leadId: string): Promise<PlanComparison | null> {
    try {
      const { resource } = await this.planComparisonsContainer.item(id, leadId).read<PlanComparison>();
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) return null;
      throw error;
    }
  }

  async getComparisonForLead(leadId: string): Promise<PlanComparison | null> {
    const query: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE c.leadId = @leadId ORDER BY c.createdAt DESC',
      parameters: [{ name: '@leadId', value: leadId }]
    };
    const { resources } = await this.planComparisonsContainer.items.query<PlanComparison>(query).fetchAll();
    return resources[0] || null;
  }

  // ==================== VENDORS ====================

  async createVendor(vendor: Vendor): Promise<Vendor> {
    const { resource } = await this.vendorsContainer.items.create(vendor);
    return resource as Vendor;
  }

  async getVendorsByLOB(lineOfBusiness: string): Promise<Vendor[]> {
    const query: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE c.lineOfBusiness = @lob AND c.isActive = true ORDER BY c.priority ASC',
      parameters: [{ name: '@lob', value: lineOfBusiness }]
    };
    const { resources } = await this.vendorsContainer.items.query<Vendor>(query).fetchAll();
    return resources;
  }

  async getAllVendors(): Promise<Vendor[]> {
    const query = 'SELECT * FROM c WHERE c.isActive = true ORDER BY c.priority ASC';
    const { resources } = await this.vendorsContainer.items.query<Vendor>(query).fetchAll();
    return resources;
  }

  async seedVendors(vendors: Omit<Vendor, 'createdAt' | 'updatedAt'>[]): Promise<void> {
    for (const vendor of vendors) {
      await this.vendorsContainer.items.upsert({
        ...vendor,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }
}

export const cosmosService = new CosmosService();

