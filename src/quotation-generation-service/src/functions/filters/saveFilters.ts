/**
 * Save Filters Function
 * Saves user-defined filter criteria for plans
 * Reference: Petli savePlanFilters
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { PlanFilter } from '../../models/plan';
import { ensureAuthorized, requirePermission, QUOTE_PERMISSIONS } from '../../lib/auth';

export async function saveFilters(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, QUOTE_PERMISSIONS.QUOTES_CREATE);
    const body: any = await request.json();

    if (!body.leadId) {
      return {
        status: 400,
        jsonBody: {
          error: 'leadId is required'
        }
      };
    }

    // Check if filter exists for this lead
    const existingFilter = await cosmosService.getFilter(body.leadId);

    const filter: PlanFilter = {
      id: existingFilter?.id || uuidv4(),
      leadId: body.leadId,
      annualPremium: body.annualPremium,
      monthlyPremium: body.monthlyPremium,
      annualLimit: body.annualLimit,
      deductible: body.deductible,
      coInsurance: body.coInsurance,
      waitingPeriod: body.waitingPeriod,
      selectedVendors: body.selectedVendors,
      excludedVendors: body.excludedVendors,
      planTypes: body.planTypes,
      requiredBenefits: body.requiredBenefits,
      excludedBenefits: body.excludedBenefits,
      createdAt: existingFilter?.createdAt || new Date(),
      updatedAt: new Date()
    };

    const savedFilter = await cosmosService.saveFilter(filter);

    // Get filtered plans count
    const allPlans = await cosmosService.getPlansForLead(body.leadId);
    const filteredPlans = applyFiltersToPlans(allPlans, savedFilter);

    // Publish event
    await eventGridService.publishPlansFiltered({
      leadId: body.leadId,
      filterCriteria: savedFilter,
      resultCount: filteredPlans.length
    });

    context.log(`Filters saved for lead ${body.leadId}, ${filteredPlans.length} plans match`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Filters saved successfully',
        data: {
          filter: savedFilter,
          matchingPlansCount: filteredPlans.length
        }
      }
    };
  } catch (error: any) {
    context.error('Save filters error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to save filters',
        details: error.message
      }
    };
  }
}

function applyFiltersToPlans(plans: any[], filter: PlanFilter): any[] {
  return plans.filter(plan => {
    if (filter.annualPremium) {
      if (filter.annualPremium.min && plan.annualPremium < filter.annualPremium.min) return false;
      if (filter.annualPremium.max && plan.annualPremium > filter.annualPremium.max) return false;
    }
    if (filter.deductible) {
      if (filter.deductible.min && plan.deductible < filter.deductible.min) return false;
      if (filter.deductible.max && plan.deductible > filter.deductible.max) return false;
    }
    if (filter.annualLimit) {
      if (filter.annualLimit.min && plan.annualLimit < filter.annualLimit.min) return false;
      if (filter.annualLimit.max && plan.annualLimit > filter.annualLimit.max) return false;
    }
    if (filter.selectedVendors && filter.selectedVendors.length > 0) {
      if (!filter.selectedVendors.includes(plan.vendorId)) return false;
    }
    return true;
  });
}

app.http('saveFilters', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'plans/filters',
  handler: saveFilters
});

