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

    // Publish plans.fetch_completed event to Event Grid (primary communication method)
    let eventPublished = false;
    try {
      await eventGridService.publishPlansFetchCompleted({
        leadId: body.leadId,
        fetchRequestId: fetchRequest.id,
        totalPlans: plans.length,
        successfulVendors,
        failedVendors,
        plans // Include full plans array for Lead Service
      });
      eventPublished = true;
      context.log('plans.fetch_completed event published successfully to Event Grid');
      
      // Delayed HTTP fallback check: Verify status was updated after Event Grid event
      // If lead is still in "Plans Fetching" after 5 seconds, use HTTP fallback
      setTimeout(async () => {
        try {
          const leadServiceUrl = process.env.LEAD_SERVICE_URL || 'https://lead-service.azurewebsites.net/api';
          const leadCheckResponse = await fetch(`${leadServiceUrl}/leads/get/${body.leadId}?lineOfBusiness=${body.lineOfBusiness}`);
          
          if (leadCheckResponse.ok) {
            const leadData: any = await leadCheckResponse.json();
            const lead = leadData.data?.lead || leadData.jsonBody?.data?.lead || leadData;
            
            // If still in "Plans Fetching" status after 5 seconds, use HTTP fallback
            if (lead && lead.currentStage === 'Plans Fetching') {
              context.warn(`Lead ${body.leadId} still in "Plans Fetching" after Event Grid event - using HTTP fallback`);
              
              const response = await fetch(`${leadServiceUrl}/leads/${body.leadId}/save-plans`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  leadId: body.leadId,
                  fetchRequestId: fetchRequest.id,
                  totalPlans: plans.length,
                  successfulVendors,
                  failedVendors,
                  plans
                })
              });
              
              if (response.ok) {
                context.log('HTTP fallback succeeded after Event Grid delay check');
              } else {
                const errorText = await response.text();
                context.warn(`HTTP fallback after delay check failed: ${response.status} - ${errorText}`);
              }
            }
          }
        } catch (checkError: any) {
          context.warn('Status check failed, but Event Grid event was published:', checkError.message);
        }
      }, 5000); // 5 second delay to check if Event Grid delivered
      
    } catch (eventError: any) {
      context.warn('Failed to publish plans.fetch_completed event to Event Grid:', eventError.message);
      
      // HTTP Fallback: Only call Lead Service directly if Event Grid fails
      // This ensures plans are saved even if Event Grid is unavailable
      try {
        const leadServiceUrl = process.env.LEAD_SERVICE_URL || 'https://lead-service.azurewebsites.net/api';
        context.log(`Event Grid failed, using HTTP fallback to save plans at ${leadServiceUrl}/leads/${body.leadId}/save-plans`);
        
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
          context.warn(`Failed to save plans to Lead Service via HTTP fallback: ${response.status} - ${errorText}`);
        } else {
          context.log('Plans saved to Lead Service via HTTP fallback successfully');
        }
      } catch (httpError: any) {
        context.error('HTTP fallback to Lead Service also failed:', httpError.message);
      }
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


