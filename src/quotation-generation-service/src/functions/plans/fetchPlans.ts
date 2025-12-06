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
import { handlePreflight, withCors } from '../../utils/corsHelper';

export async function fetchPlans(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const body: FetchPlansRequest = await request.json() as FetchPlansRequest;

    if (!body.leadId || !body.lineOfBusiness) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          error: 'leadId and lineOfBusiness are required'
        }
      });
    }

    // Check if plans already exist for this lead
    const existingPlans = await cosmosService.getPlansForLead(body.leadId);
    if (existingPlans.length > 0 && !body.forceRefresh) {
      return withCors(request, {
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
      });
    }

    // If forceRefresh is true and plans exist, delete them first
    if (body.forceRefresh && existingPlans.length > 0) {
      context.log(`Force refresh requested - deleting ${existingPlans.length} existing plans`);
      await cosmosService.deletePlansForLead(body.leadId);
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
    try {
      await eventGridService.publishPlansFetchStarted({
        leadId: body.leadId,
        fetchRequestId: fetchRequest.id,
        lineOfBusiness: body.lineOfBusiness,
        vendorCount: vendors.length
      });
    } catch (eventError) {
      context.warn('Event Grid not available, continuing without event publishing:', eventError);
    }

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

    // Publish fetch completed event (for logging in mock Event Grid)
    try {
      await eventGridService.publishPlansFetchCompleted({
        leadId: body.leadId,
        fetchRequestId: fetchRequest.id,
        totalPlans: plans.length,
        successfulVendors,
        failedVendors,
        plans // Include full plans array for Lead Service
      });
      context.log('Event published to Event Grid (for logging)');
    } catch (eventError) {
      context.warn('Event Grid publish failed (non-critical):', eventError);
    }
    
    // HTTP Fallback: Always call Lead Service directly since Event Grid doesn't route events locally
    try {
      const leadServiceUrl = process.env.LEAD_SERVICE_URL || 'http://localhost:7075/api';
      context.log(`Saving plans to Lead Service via HTTP at ${leadServiceUrl}/leads/${body.leadId}/save-plans`);
      
      const response = await fetch(`${leadServiceUrl}/leads/${body.leadId}/save-plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leadId: body.leadId,
          fetchRequestId: fetchRequest.id,
          totalPlans: plans.length,
          successfulVendors,
          failedVendors,
          plans
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        context.warn(`Failed to save plans to Lead Service: ${response.status} - ${errorText}`);
      } else {
        context.log('Plans saved to Lead Service via HTTP successfully');
      }
    } catch (httpError: any) {
      context.error('HTTP fallback to Lead Service failed:', httpError);
    }

    context.log(`Plans fetched successfully for lead ${body.leadId}: ${plans.length} plans from ${successfulVendors.length} vendors`);

    return withCors(request, {
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
    });
  } catch (error: any) {
    context.error('Fetch plans error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to fetch plans',
        details: error.message
      }
    });
  }
}

app.http('fetchPlans', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'plans/fetch',
  handler: fetchPlans
});


