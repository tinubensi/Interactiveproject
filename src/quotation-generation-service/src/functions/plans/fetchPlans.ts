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
import { ensureAuthorized, requirePermission, QUOTE_PERMISSIONS, validateServiceKey } from '../../lib/auth';
import { handlePreflight, withCors } from '../../utils/corsHelper';
import { notifyPipelineService } from '../../utils/pipelineFallback';

export async function fetchPlans(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    // CRITICAL FIX: Allow service key authentication for internal service calls
    // This allows Pipeline Service to trigger plan fetching without user authentication
    const isServiceCall = validateServiceKey(request);

    if (!isServiceCall) {
      // For user calls, require authentication
      const userContext = await ensureAuthorized(request);
      await requirePermission(userContext.userId, QUOTE_PERMISSIONS.QUOTES_CREATE);
    } else {
      context.log('Plan fetch request authenticated via service key (internal service call)');
    }

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
    let fetchStartedPublished = false;
    try {
      await eventGridService.publishPlansFetchStarted({
        leadId: body.leadId,
        fetchRequestId: fetchRequest.id,
        lineOfBusiness: body.lineOfBusiness,
        vendorCount: vendors.length
      });
      fetchStartedPublished = true;
      context.log('plans.fetch_started event published successfully to Event Grid');
    } catch (eventError) {
      context.warn('Event Grid not available for plans.fetch_started, using HTTP fallback:', eventError);
    }

    // HTTP Fallback: Also notify pipeline service directly for plans.fetch_started
    if (!fetchStartedPublished) {
      try {
        await notifyPipelineService('plans.fetch_started', {
          leadId: body.leadId,
          lineOfBusiness: body.lineOfBusiness,
          businessType: body.businessType,
          fetchRequestId: fetchRequest.id,
          vendorCount: vendors.length,
        }, { log: context.log.bind(context) });
        context.log('[HTTP Fallback] Successfully notified pipeline service: plans.fetch_started');
      } catch (fallbackError) {
        context.warn(`[HTTP Fallback] Failed to notify pipeline service for plans.fetch_started: ${fallbackError}`);
      }
    } else {
      // Even if Event Grid succeeds, also send HTTP fallback as backup
      try {
        await notifyPipelineService('plans.fetch_started', {
          leadId: body.leadId,
          lineOfBusiness: body.lineOfBusiness,
          businessType: body.businessType,
          fetchRequestId: fetchRequest.id,
          vendorCount: vendors.length,
        }, { log: context.log.bind(context) });
      } catch (fallbackError) {
        // Silent fail - Event Grid already published
        context.log(`[HTTP Fallback] Backup notification failed (Event Grid succeeded): ${fallbackError}`);
      }
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

      // HTTP Fallback: Also notify pipeline service directly
      try {
        await notifyPipelineService('plans.fetch_completed', {
          leadId: body.leadId,
          lineOfBusiness: body.lineOfBusiness,
          businessType: body.businessType,
          fetchRequestId: fetchRequest.id,
          totalPlans: plans.length,
          successfulVendors,
          failedVendors,
        }, { log: context.log.bind(context) });
      } catch (fallbackError) {
        context.warn(`[HTTP Fallback] Failed to notify pipeline service: ${fallbackError}`);
      }

      // Delayed HTTP fallback check REMOVED
      // We rely on the immediate HTTP fallback (sent above) and Event Grid
      // This removes the 5 second blocking wait

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


