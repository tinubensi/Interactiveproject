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
import { rpaJobService } from '../../services/rpaJobService';
import { FetchPlansRequest, PlanFetchRequest } from '../../models/plan';
import { ensureAuthorized, requirePermission, QUOTE_PERMISSIONS, validateServiceKey } from '../../lib/auth';
import { handlePreflight, withCors } from '../../utils/corsHelper';
import { notifyPipelineService } from '../../utils/pipelineFallback';
import { cleanAndMergeFormData } from '../../utils/formDataCleaner';

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
    
    // CRITICAL: Clean formData before processing to prevent RPA bots from receiving polluted data
    if (body.leadData && body.leadData.formData) {
      body.leadData.formData = cleanAndMergeFormData(
        body.leadData.formData,
        body.leadData.lobData
      );
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

    // Separate RPA-enabled vendors from static-plan vendors
    const rpaVendors = vendors.filter(v => v.rpaEnabled === true);
    const staticVendors = vendors.filter(v => v.hasStaticPlans === true && v.rpaEnabled !== true);
    
    context.log(`Vendors breakdown: ${rpaVendors.length} RPA-enabled, ${staticVendors.length} static plans`);
    
    // Trigger RPA via VM for RPA-enabled vendors
    const vendorIds = rpaVendors.map(v => v.id);
    let totalPlans = 0;
    let successfulVendors = 0;
    let vendorTimings: Array<{
      vendorId: string;
      vendorName: string;
      success: boolean;
      executionTime: string;
      plansCount: number;
      error?: string;
    }> = [];
    
    if (vendorIds.length === 0) {
      context.log('No RPA-enabled vendors found, skipping RPA');
    } else {
      context.log(`Calling VM for ${vendorIds.length} RPA-enabled vendor(s)...`);
      
      // Import VM service
      const { rpaVmService } = await import('../../services/rpaVmService');
      
      if (!rpaVmService.isEnabled()) {
        context.error('RPA VM service not configured!');
        return withCors(request, {
          status: 500,
          jsonBody: {
            success: false,
            error: 'RPA VM service not configured (RPA_VM_URL missing)'
          }
        });
      }
      
      // Fetch plans from VM (blocks until complete)
      const vmResults = await rpaVmService.fetchPlansFromAllVendors(
        body.leadId,
        body.leadData,
        vendorIds
      );
      
      // Count results and collect successful vendor IDs
      const successfulVendorIds: string[] = [];
      for (const result of vmResults) {
        if (result.success) {
          successfulVendors++;
          totalPlans += result.plans.length;
          successfulVendorIds.push(result.vendorId);
        }
      }
      
      // Collect vendor timing data for timeline (FIX: use let vendorTimings, not const)
      vendorTimings = vmResults.map(result => ({
        vendorId: result.vendorId,
        vendorName: result.vendorId.replace('vendor-', ''),
        success: result.success,
        executionTime: result.executionTime || 'N/A',
        plansCount: result.plans.length,
        error: result.error  // For backend logging only
      }));
      
      context.log(`VM execution complete: ${successfulVendors}/${vendorIds.length} vendors successful, ${totalPlans} plans fetched`);
      context.log(`[VENDOR TIMINGS] Collected ${vendorTimings.length} vendor timing entries:`, JSON.stringify(vendorTimings, null, 2));
    }

    // Update fetch request status
    await cosmosService.updateFetchRequest(fetchRequest.id, fetchRequest.leadId, {
      status: 'completed',
      completedAt: new Date(),
      totalPlansFound: totalPlans,
      successfulVendors: vendorIds // Track all vendors for now
    });

    // Plans are already in Cosmos DB (saved by rpaVmService)
    context.log(`Plan fetching completed for lead ${body.leadId}`);
    context.log(`  - Plans fetched: ${totalPlans}`);
    context.log(`  - Successful vendors: ${successfulVendors}/${vendorIds.length}`);

    // Publish completion event (for pipeline service)
    try {
      const eventMetadata = vendorTimings.length > 0 ? {
        vendorTimings: vendorTimings.map(({ error, ...rest }) => rest)  // Exclude error from event
      } : undefined;
      
      context.log(`[EVENT PUBLISH] Publishing plans.fetch_completed with metadata:`, JSON.stringify(eventMetadata, null, 2));
      
      await eventGridService.publishPlansFetchCompleted({
        leadId: body.leadId,
        fetchRequestId: fetchRequest.id,
        totalPlans: totalPlans,
        successfulVendors: vendorIds, // Array of vendor IDs
        failedVendors: [], // Track failures if needed
        plans: [], // Plans already saved to Cosmos
        metadata: eventMetadata
      });
      
      context.log(`[EVENT PUBLISH] ✓ plans.fetch_completed event published successfully`);
    } catch (eventError) {
      context.warn('Failed to publish completion event:', eventError);
    }

    return withCors(request, {
      status: 200, // Changed from 202 to 200 (synchronous now)
      jsonBody: {
        success: true,
        message: 'Plan fetching completed',
        data: {
          leadId: body.leadId,
          fetchRequestId: fetchRequest.id,
          status: 'completed',
          totalPlans: totalPlans,
          successfulVendors: successfulVendors,
          failedVendors: vendorIds.length - successfulVendors
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


