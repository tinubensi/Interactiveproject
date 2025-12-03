/**
 * Fetch Plans Function
 * Triggers plan fetching from vendors for a lead
 * Reference: Petli getPlans logic
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { planFetchingService } from '../../services/planFetchingService';
import { FetchPlansRequest, PlanFetchRequest } from '../../models/plan';

export async function fetchPlans(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const body: FetchPlansRequest = await request.json() as FetchPlansRequest;

    if (!body.leadId || !body.lineOfBusiness) {
      return {
        status: 400,
        jsonBody: {
          error: 'leadId and lineOfBusiness are required'
        }
      };
    }

    // Check if plans already exist for this lead
    const existingPlans = await cosmosService.getPlansForLead(body.leadId);
    if (existingPlans.length > 0 && !body.forceRefresh) {
      return {
        status: 200,
        jsonBody: {
          success: true,
          message: 'Plans already fetched for this lead',
          data: {
            plans: existingPlans,
            totalPlans: existingPlans.length,
            cached: true
          }
        }
      };
    }

    // Create fetch request
    const fetchRequest: PlanFetchRequest = {
      id: uuidv4(),
      leadId: body.leadId,
      lineOfBusiness: body.lineOfBusiness,
      businessType: body.businessType,
      leadData: body.leadData,
      status: 'fetching',
      totalVendors: 0,
      successfulVendors: [],
      failedVendors: [],
      unavailableVendors: [],
      totalPlansFound: 0,
      createdAt: new Date(),
      startedAt: new Date()
    };

    await cosmosService.createFetchRequest(fetchRequest);

    // Get vendors for this LOB
    const vendors = await cosmosService.getVendorsByLOB(body.lineOfBusiness);
    
    // Publish fetch started event
    await eventGridService.publishPlansFetchStarted({
      leadId: body.leadId,
      fetchRequestId: fetchRequest.id,
      lineOfBusiness: body.lineOfBusiness,
      vendorCount: vendors.length
    });

    // Fetch plans
    const { plans, successfulVendors, failedVendors } = await planFetchingService.fetchPlansForLead({
      leadId: body.leadId,
      lineOfBusiness: body.lineOfBusiness,
      businessType: body.businessType,
      leadData: body.leadData,
      fetchRequestId: fetchRequest.id
    });

    // Save plans to database
    await cosmosService.createPlans(plans);

    // Mark recommended plan
    const recommendedPlan = planFetchingService.calculateRecommendedPlan(plans);
    if (recommendedPlan) {
      await cosmosService.updatePlan(recommendedPlan.id, body.leadId, { isRecommended: true });
    }

    // Update fetch request status
    await cosmosService.updateFetchRequest(fetchRequest.id, body.leadId, {
      status: 'completed',
      totalVendors: vendors.length,
      successfulVendors,
      failedVendors,
      totalPlansFound: plans.length,
      completedAt: new Date()
    });

    // Publish fetch completed event
    await eventGridService.publishPlansFetchCompleted({
      leadId: body.leadId,
      fetchRequestId: fetchRequest.id,
      totalPlans: plans.length,
      successfulVendors,
      failedVendors
    });

    context.log(`Plans fetched successfully for lead ${body.leadId}: ${plans.length} plans from ${successfulVendors.length} vendors`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Plans fetched successfully',
        data: {
          fetchRequestId: fetchRequest.id,
          totalPlans: plans.length,
          vendors: successfulVendors,
          plans,
          recommendedPlanId: recommendedPlan?.id
        }
      }
    };
  } catch (error: any) {
    context.error('Fetch plans error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to fetch plans',
        details: error.message
      }
    };
  }
}

app.http('fetchPlans', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'plans/fetch',
  handler: fetchPlans
});


