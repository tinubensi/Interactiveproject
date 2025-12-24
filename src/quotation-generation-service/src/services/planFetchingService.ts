/**
 * Plan Fetching Service
 * Fetches insurance plans from Cosmos DB (lead-service-db/plans)
 * Plans are automatically fetched by RPA when leads are created
 */

import { Plan, LineOfBusiness, Vendor, BenefitCategory } from '../models/plan';
import { CosmosClient, SqlQuerySpec } from '@azure/cosmos';

class PlanFetchingService {
  private leadsDBCosmosClient: CosmosClient | null = null;

  /**
   * Get Cosmos client for lead-service-db (where RPA saves plans)
   */
  private getLeadsDBClient(): CosmosClient {
    if (!this.leadsDBCosmosClient) {
      const connectionString = process.env.LEADS_DB_CONNECTION_STRING || process.env.COSMOS_CONNECTION_STRING;
      if (!connectionString) {
        throw new Error('COSMOS_CONNECTION_STRING must be set');
      }
      this.leadsDBCosmosClient = new CosmosClient(connectionString);
    }
    return this.leadsDBCosmosClient;
  }

  /**
   * Fetch plans for a lead from Cosmos DB (lead-service-db/plans)
   * Plans are fetched by RPA bots from real insurance portals
   * NO STATIC PLANS - Only real plans from vendors
   */
  async fetchPlansForLead(params: {
    leadId: string;
    lineOfBusiness: LineOfBusiness;
    businessType: string;
    leadData: any;
    fetchRequestId: string;
  }): Promise<{
    plans: Plan[];
    successfulVendors: string[];
    failedVendors: string[];
  }> {
    const { leadId, fetchRequestId } = params;

    console.log(`🔍 Fetching RPA plans for lead ${leadId} from Cosmos DB (lead-service-db/plans)`);

    try {
      // Query plans from lead-service-db/plans (where RPA saves them)
      const rpaPlans = await this.fetchPlansFromCosmosDB(leadId, fetchRequestId);

      if (rpaPlans.plans.length > 0) {
        console.log(`✅ Found ${rpaPlans.plans.length} RPA-fetched plans from real portals`);
        return rpaPlans;
      }

      console.log(`⚠️ No RPA plans found yet for lead ${leadId} - RPA may still be running`);
      
      // Return empty results - no static fallback
      return {
        plans: [],
        successfulVendors: [],
        failedVendors: []
      };
      
    } catch (error) {
      console.error('❌ Error querying Cosmos DB for RPA plans:', error);
      throw error;
    }
  }

  /**
   * Fetch plans from Cosmos DB lead-service-db/plans container
   * Plans are automatically saved here by RPA containers when leads are created
   */
  async fetchPlansFromCosmosDB(leadId: string, fetchRequestId: string): Promise<{
    plans: Plan[];
    successfulVendors: string[];
    failedVendors: string[];
  }> {
    try {
      const client = this.getLeadsDBClient();
      const database = client.database('lead-service-db');  // Same database as Lead Service
      const container = database.container('plans');

      // Query plans for this lead
      const query: SqlQuerySpec = {
        query: 'SELECT * FROM c WHERE c.leadId = @leadId ORDER BY c.fetchedAt DESC',
        parameters: [{ name: '@leadId', value: leadId }]
      };

      const { resources: standardPlans } = await container.items.query(query).fetchAll();

      console.log(`Found ${standardPlans.length} RPA plans in Cosmos DB for lead ${leadId}`);

      // Transform StandardPlan format to Plan format
      const plans = standardPlans.map((sp: any) => this.transformStandardPlanToPlan(sp, fetchRequestId));

      // Get successful vendors
      const successfulVendors = Array.from(new Set(plans.map(p => p.vendorId)));
      const failedVendors: string[] = [];

      return {
        plans,
        successfulVendors,
        failedVendors
      };

    } catch (error: any) {
      console.error('❌ Error fetching plans from Cosmos DB:', error.message);
      throw error;
    }
  }

  /**
   * Transform StandardPlan from Cosmos DB to Plan model
   */
  private transformStandardPlanToPlan(standardPlan: any, fetchRequestId: string): Plan {
    // Handle the new StandardPlan format from Watania parser
    // Priority: Use direct fields (annualPremium, annualLimit) over nested (premium.amount, coverage.inpatient)
    
    return {
      id: standardPlan.id,
      leadId: standardPlan.leadId,
      fetchRequestId: fetchRequestId,
      vendorId: standardPlan.vendorId,
      vendorName: standardPlan.vendorName,
      vendorCode: standardPlan.vendorCode || standardPlan.vendorId,
      planName: standardPlan.planName,
      planCode: standardPlan.planCode,
      planType: standardPlan.planType || 'comprehensive',
      // Direct field mapping for new StandardPlan format
      annualPremium: standardPlan.annualPremium || 0,
      monthlyPremium: standardPlan.monthlyPremium || (standardPlan.annualPremium / 12) || 0,
      currency: standardPlan.currency || 'AED',
      annualLimit: standardPlan.annualLimit || 0,
      deductible: standardPlan.deductible || 0,
      coInsurance: standardPlan.coInsurance || 0,
      waitingPeriod: this.parseWaitingPeriod(standardPlan.waitingPeriod),
      benefits: this.transformBenefits(standardPlan.benefits),
      exclusions: standardPlan.exclusions || [],
      lineOfBusiness: standardPlan.lineOfBusiness || 'medical',
      isAvailable: standardPlan.isAvailable !== undefined ? standardPlan.isAvailable : true,
      isSelected: standardPlan.isSelected || false,
      isRecommended: standardPlan.isRecommended || false,
      fetchedAt: new Date(standardPlan.fetchedAt || Date.now()),
      source: standardPlan.source || 'rpa',
      rawPlanData: standardPlan.rawPlanData || standardPlan
    };
  }

  /**
   * Parse waiting period from various formats
   */
  private parseWaitingPeriod(waitingPeriod: any): number {
    if (typeof waitingPeriod === 'number') return waitingPeriod;
    if (typeof waitingPeriod === 'string') {
      const match = waitingPeriod.match(/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    }
    return 0;
  }

  /**
   * Transform benefits to structured format
   * Handles both array format (legacy) and structured format (StandardPlan)
   */
  private transformBenefits(benefits: any): BenefitCategory[] {
    if (!benefits) return [];
    
    // If benefits is already an array of categories (StandardPlan format)
    if (Array.isArray(benefits) && benefits.length > 0 && benefits[0].category) {
      return benefits.map((cat: any, catIdx: number) => ({
        categoryId: cat.category?.toLowerCase().replace(/\s+/g, '-') || `category-${catIdx}`,
        categoryName: cat.category || 'General',
        benefits: (cat.items || []).map((item: any, itemIdx: number) => ({
          benefitId: `${cat.category}-${itemIdx}`,
          name: item.name || item,
          covered: item.coverage !== 'Not covered',
          description: item.coverage || item.limit || item.description || '',
          limit: item.limit
        }))
      }));
    }
    
    // Legacy format: array of strings
    if (Array.isArray(benefits)) {
      return [{
        categoryId: 'general',
        categoryName: 'Coverage Benefits',
        benefits: benefits.map((b: any, idx: number) => ({
          benefitId: `benefit-${idx}`,
          name: typeof b === 'string' ? b : b.name,
          covered: true,
          description: typeof b === 'string' ? b : b.description || b.coverage || ''
        }))
      }];
    }
    
    return [];
  }

  /**
   * Calculate recommended plan based on criteria
   */
  calculateRecommendedPlan(plans: Plan[]): Plan | null {
    if (plans.length === 0) return null;

    // Simple recommendation logic: Best value (coverage to price ratio)
    const plansWithScore = plans.map(plan => {
      const coverageScore = plan.annualLimit / 1000;
      const priceScore = 100000 / plan.annualPremium;
      const waitingPenalty = plan.waitingPeriod / 30;
      const deductiblePenalty = plan.deductible / 100;
      
      const score = (coverageScore * 0.4) + (priceScore * 0.4) - (waitingPenalty * 0.1) - (deductiblePenalty * 0.1);
      
      return { plan, score };
    });

    plansWithScore.sort((a, b) => b.score - a.score);
    return plansWithScore[0].plan;
  }
}

export const planFetchingService = new PlanFetchingService();


