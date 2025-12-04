/**
 * Plan Fetching Service
 * Fetches insurance plans from vendors (static for now, RPA later)
 * Reference: Petli getPlans logic
 */

import { Plan, LineOfBusiness, Vendor } from '../models/plan';
import { getStaticPlansForLead } from '../data/staticPlans';

class PlanFetchingService {
  /**
   * Fetch plans for a lead from all available vendors
   * Currently uses static data, will integrate with RPA APIs in future
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
    const { leadId, lineOfBusiness, businessType, leadData, fetchRequestId } = params;

    console.log(`Fetching plans for lead ${leadId} - ${lineOfBusiness}/${businessType}`);

    // For now: Use static plans
    const staticPlans = getStaticPlansForLead(leadId, lineOfBusiness, businessType, leadData);
    
    // Add fetchRequestId to each plan
    const plans = staticPlans.map(plan => ({
      ...plan,
      fetchRequestId
    }));

    const successfulVendors = Array.from(new Set(plans.map(p => p.vendorName)));
    const failedVendors: string[] = [];

    console.log(`Fetched ${plans.length} plans from ${successfulVendors.length} vendors`);

    return {
      plans,
      successfulVendors,
      failedVendors
    };
  }

  /**
   * Future: Fetch plans from RPA API
   */
  async fetchPlansFromRPA(
    vendor: Vendor,
    leadData: any
  ): Promise<Plan[]> {
    // TODO: Implement RPA API integration
    // 1. Transform leadData to vendor-specific format
    // 2. Call RPA endpoint
    // 3. Parse response
    // 4. Transform to Plan model
    // 5. Handle errors gracefully
    
    console.log(`RPA integration not yet implemented for ${vendor.name}`);
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


