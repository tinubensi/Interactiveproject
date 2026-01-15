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
   * Supports Unified Structure V2 with optional sub-limits, network, copays, and waiting periods
   */
  private transformStandardPlanToPlan(standardPlan: any, fetchRequestId: string): Plan {
    // Handle the new StandardPlan format from RPA parsers
    // Priority: Use direct fields (annualPremium, annualLimit) over legacy fields
    
    // Build coverage limits object (Unified Structure V2)
    const coverageLimits: any = {
      annualLimit: standardPlan.annualLimit || standardPlan.coverageAmount || 0
    };
    
    // Add optional sub-limits if available (don't include if undefined/null)
    if (standardPlan.inpatientLimit) coverageLimits.inpatientLimit = standardPlan.inpatientLimit;
    if (standardPlan.outpatientLimit) coverageLimits.outpatientLimit = standardPlan.outpatientLimit;
    if (standardPlan.maternityLimit) coverageLimits.maternityLimit = standardPlan.maternityLimit;
    if (standardPlan.emergencyLimit) coverageLimits.emergencyLimit = standardPlan.emergencyLimit;
    if (standardPlan.pharmacyLimit) coverageLimits.pharmacyLimit = standardPlan.pharmacyLimit;
    if (standardPlan.dentalLimit) coverageLimits.dentalLimit = standardPlan.dentalLimit;
    if (standardPlan.opticalLimit) coverageLimits.opticalLimit = standardPlan.opticalLimit;
    
    // Build cost sharing object (Unified Structure V2)
    const costSharing: any = {
      deductible: standardPlan.deductible || 0,
      deductibleMetric: standardPlan.deductibleMetric || 'AED',
      coInsurance: standardPlan.coInsurance || 0,
      coInsuranceMetric: standardPlan.coInsuranceMetric || '%'
    };
    
    // Add copays if available
    if (standardPlan.copays) {
      costSharing.copays = standardPlan.copays;
    }
    
    // Build waiting periods object (Unified Structure V2)
    let waitingPeriods: any = undefined;
    if (standardPlan.waitingPeriods) {
      waitingPeriods = standardPlan.waitingPeriods;
    }
    
    const transformedPlan: Plan = {
      id: standardPlan.id,
      leadId: standardPlan.leadId,
      fetchRequestId: fetchRequestId,
      vendorId: standardPlan.vendorId,
      vendorName: standardPlan.vendorName,
      vendorCode: standardPlan.vendorCode || standardPlan.vendorId,
      planName: standardPlan.planName,
      planCode: standardPlan.planCode,
      planType: standardPlan.planType || 'comprehensive',
      // Pricing
      annualPremium: standardPlan.annualPremium || 0,
      monthlyPremium: standardPlan.monthlyPremium || (standardPlan.annualPremium / 12) || 0,
      currency: standardPlan.currency || 'AED',
      // Coverage limits (Unified Structure V2)
      coverageLimits: coverageLimits,
      // For backward compatibility, keep top-level annualLimit
      annualLimit: coverageLimits.annualLimit,
      // Cost sharing (Unified Structure V2)
      costSharing: costSharing,
      // For backward compatibility, keep top-level deductible and coInsurance
      deductible: costSharing.deductible,
      coInsurance: costSharing.coInsurance,
      // Waiting period (keep simple top-level for backward compatibility)
      waitingPeriod: this.parseWaitingPeriod(standardPlan.waitingPeriod),
      // Benefits and exclusions
      benefits: this.transformBenefits(standardPlan.benefits),
      exclusions: standardPlan.exclusions || [],
      // Metadata
      lineOfBusiness: standardPlan.lineOfBusiness || 'medical',
      isAvailable: standardPlan.isAvailable !== undefined ? standardPlan.isAvailable : true,
      isSelected: standardPlan.isSelected || false,
      isRecommended: standardPlan.isRecommended || false,
      fetchedAt: new Date(standardPlan.fetchedAt || Date.now()),
      source: standardPlan.source || 'rpa',
      rawPlanData: standardPlan.rawPlanData || standardPlan.rawData || standardPlan
    };
    
    // Add optional unified structure fields if available
    if (waitingPeriods) {
      transformedPlan.waitingPeriods = waitingPeriods;
    }
    
    // Add network object if available (Unified Structure V2)
    if (standardPlan.network) {
      transformedPlan.network = standardPlan.network;
    }
    
    return transformedPlan;
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


