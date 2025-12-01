/**
 * List Plans Function
 * Lists plans with advanced filtering and pagination
 * Reference: Petli getPlans with filters
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { PlanListRequest } from '../../models/plan';

export async function listPlans(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const body: PlanListRequest = await request.json() as PlanListRequest;

    if (!body.leadId) {
      return {
        status: 400,
        jsonBody: {
          error: 'leadId is required'
        }
      };
    }

    // Set defaults
    const listRequest: PlanListRequest = {
      leadId: body.leadId,
      page: body.page || 1,
      limit: Math.min(body.limit || 20, 100),
      sortBy: body.sortBy || 'annualPremium',
      sortOrder: body.sortOrder || 'asc',
      filters: body.filters || {},
      applyFilterId: body.applyFilterId
    };

    // If applyFilterId is provided, load saved filter
    if (listRequest.applyFilterId) {
      const savedFilter = await cosmosService.getFilter(body.leadId);
      if (savedFilter) {
        listRequest.filters = {
          ...listRequest.filters,
          annualPremium: savedFilter.annualPremium,
          monthlyPremium: savedFilter.monthlyPremium,
          annualLimit: savedFilter.annualLimit,
          deductible: savedFilter.deductible,
          coInsurance: savedFilter.coInsurance,
          waitingPeriod: savedFilter.waitingPeriod,
          vendorIds: savedFilter.selectedVendors
        };
      }
    }

    // Query Cosmos DB
    const result = await cosmosService.listPlans(listRequest);

    // Calculate aggregations
    const allPlans = await cosmosService.getPlansForLead(body.leadId);
    result.aggregations = {
      totalPlans: allPlans.length,
      availablePlans: allPlans.filter(p => p.isAvailable).length,
      selectedPlans: allPlans.filter(p => p.isSelected).length,
      byVendor: Array.from(new Set(allPlans.map(p => p.vendorName))).map(vendor => ({
        vendor,
        count: allPlans.filter(p => p.vendorName === vendor).length,
        avgPremium: allPlans.filter(p => p.vendorName === vendor).reduce((sum, p) => sum + p.annualPremium, 0) / allPlans.filter(p => p.vendorName === vendor).length
      }))
    };

    // Calculate recommendations
    const sortedByPrice = [...result.data].sort((a, b) => a.annualPremium - b.annualPremium);
    const sortedByCoverage = [...result.data].sort((a, b) => b.annualLimit - a.annualLimit);
    const recommended = result.data.find(p => p.isRecommended);

    result.recommendations = {
      bestValue: recommended?.id || sortedByPrice[0]?.id || '',
      lowestPrice: sortedByPrice[0]?.id || '',
      bestCoverage: sortedByCoverage[0]?.id || ''
    };

    context.log(`Listed ${result.data.length} plans for lead ${body.leadId}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        ...result
      }
    };
  } catch (error: any) {
    context.error('List plans error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to list plans',
        details: error.message
      }
    };
  }
}

app.http('listPlans', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'plans/list',
  handler: listPlans
});


