/**
 * Refetch Plans Endpoint
 * Triggers re-fetching of plans for an existing lead
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { handlePreflight, withCors } from '../../utils/corsHelper';
import { v4 as uuidv4 } from 'uuid';
import { isLeadManagedByPipeline } from '../../services/pipelineServiceClient';

export async function refetchPlans(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const leadId = request.params.leadId;

    if (!leadId) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'Lead ID is required' 
        }
      });
    }

    // Extract optional metadata from request body
    let requestBody: any = {};
    try {
      const bodyText = await request.text();
      if (bodyText) {
        requestBody = JSON.parse(bodyText);
      }
    } catch (error) {
      // Body is optional, continue with empty object
    }
    
    const triggeredBy = requestBody.triggeredBy || 'system';
    const reason = requestBody.reason || 'Plans refetch requested - fetching updated plans from vendors';
    const formUpdated = requestBody.formUpdated || false;

    // First, find the lead to get its partition key (lineOfBusiness)
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.id = @leadId AND c.type = "lead"',
      parameters: [{ name: '@leadId', value: leadId }]
    };

    const container = cosmosService['leadsContainer'];
    const { resources: leads } = await container.items.query(querySpec).fetchAll();

    if (leads.length === 0) {
      return withCors(request, {
        status: 404,
        jsonBody: { 
          success: false,
          error: 'Lead not found' 
        }
      });
    }

    const lead = leads[0];
    
    // CRITICAL: Add retry logic to get the latest lead data
    // This ensures we have the most recent lobData, especially after updates
    // Cosmos DB eventual consistency may cause delays, so we retry with exponential backoff
    let latestLead = null;
    const maxRetries = 5;
    const retryDelays = [500, 1000, 2000, 3000, 5000]; // Start faster for refetch scenarios
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      latestLead = await cosmosService.getLeadById(leadId, lead.lineOfBusiness);
      
      if (latestLead) {
        context.log(`[REFETCH] ✓ Retrieved latest lead data (attempt ${attempt + 1})`);
        context.log(`[REFETCH] Lead emirate: ${latestLead.emirate}`);
        context.log(`[REFETCH] Lead lobData keys: ${Object.keys(latestLead.lobData || {}).join(', ')}`);
        break;
      }
      
      if (attempt < maxRetries - 1) {
        context.log(`[REFETCH] ⚠ Lead not found, retrying in ${retryDelays[attempt]}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
      }
    }
    
    if (!latestLead) {
      return withCors(request, {
        status: 404,
        jsonBody: { 
          success: false,
          error: 'Lead not found after initial query' 
        }
      });
    }

    // Delete existing plans for this lead
    await cosmosService.deletePlansForLead(leadId);

    // Check if this lead is managed by a pipeline
    const hasPipeline = await isLeadManagedByPipeline(leadId);
    
    let updatedLead;
    if (hasPipeline) {
      context.log(`Lead ${leadId} is managed by pipeline - updating status to Plans Refetching for immediate UI feedback`);
      // Update status immediately so UI shows refetch state
      // Pipeline Service will also track the progression
      updatedLead = await cosmosService.updateLead(leadId, latestLead.lineOfBusiness, {
        currentStage: 'Plans Refetching',
        stageId: 'stage-1',
        plansCount: 0,
        updatedAt: new Date()
      });
    } else {
      // No pipeline active - fallback to direct stage update (for legacy leads without pipelines)
      context.log(`Lead ${leadId} has no active pipeline - updating stage directly as fallback`);
      
      // Update lead status to "Plans Refetching" (fallback to "Plans Fetching" for legacy compatibility)
      updatedLead = await cosmosService.updateLead(leadId, latestLead.lineOfBusiness, {
        currentStage: 'Plans Refetching',
        stageId: 'stage-1',
        plansCount: 0,
        updatedAt: new Date()
      });
    }

    // ALWAYS create timeline entry for refetch operations (regardless of pipeline status)
    await cosmosService.createTimelineEntry({
      id: uuidv4(),
      leadId: leadId,
      stage: hasPipeline ? latestLead.currentStage : 'Plans Fetching',
      previousStage: lead.currentStage,
      stageId: hasPipeline ? latestLead.stageId : 'stage-1',
      eventType: 'refetch_plans_triggered',
      remark: reason,
      changedBy: triggeredBy,
      changedByName: triggeredBy === 'system' ? 'System' : 'User',
      timestamp: new Date(),
      metadata: {
        action: 'refetch_plans',
        formUpdated: formUpdated,
        hasPipeline: hasPipeline,
        triggeredBy: triggeredBy
      }
    });

    // Publish lead.created event to Event Grid (primary communication method)
    // Use latestLead to ensure we have the most recent data including updated lobData
    let eventPublished = false;
    try {
      await eventGridService.publishLeadCreated({
        leadId: latestLead.id,
        referenceId: latestLead.referenceId,
        customerId: latestLead.customerId,
        lineOfBusiness: latestLead.lineOfBusiness,
        businessType: latestLead.businessType,
        formId: latestLead.formId,
        formData: latestLead.formData,
        lobData: latestLead.lobData, // Use latest lobData from updated lead
        assignedTo: latestLead.assignedTo,
        createdAt: latestLead.createdAt,
        // 🔧 ADD CONTACT FIELDS FOR RPA BOTS
        firstName: latestLead.firstName,
        lastName: latestLead.lastName,
        email: latestLead.email,
        phone: latestLead.phone,
        emirate: latestLead.emirate
      });
      eventPublished = true;
      context.log('lead.created event published successfully to Event Grid');
      
      // CRITICAL FIX: If pipeline is active, explicitly notify Pipeline Service via HTTP fallback
      // This ensures Pipeline Service knows about the refetch operation even if Event Grid fails
      if (hasPipeline) {
        const pipelineServiceUrl = process.env.PIPELINE_SERVICE_URL || 'https://pipeline-service.azurewebsites.net/api';
        const maxHttpRetries = 3;
        const httpRetryDelays = [1000, 2000, 3000];
        let pipelineNotified = false;
        
        for (let httpAttempt = 0; httpAttempt < maxHttpRetries; httpAttempt++) {
          try {
            context.log(`[PIPELINE NOTIFICATION] Attempt ${httpAttempt + 1}/${maxHttpRetries}: Notifying pipeline service about lead refetch for lead ${leadId}`);
            
            const response = await fetch(`${pipelineServiceUrl}/events/process`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-service-key': process.env.INTERNAL_SERVICE_KEY || ''
              },
              body: JSON.stringify({
                eventType: 'lead.created',
                leadId: latestLead.id,
                lineOfBusiness: latestLead.lineOfBusiness,
                data: {
                  leadId: latestLead.id,
                  referenceId: latestLead.referenceId,
                  customerId: latestLead.customerId,
                  lineOfBusiness: latestLead.lineOfBusiness,
                  businessType: latestLead.businessType,
                  formId: latestLead.formId,
                  formData: latestLead.formData,
                  lobData: latestLead.lobData,
                  assignedTo: latestLead.assignedTo,
                  createdAt: latestLead.createdAt.toISOString(),
                  firstName: latestLead.firstName,
                  lastName: latestLead.lastName,
                  email: latestLead.email,
                  phone: latestLead.phone,
                  emirate: latestLead.emirate,
                  isRefetch: true, // Flag to indicate this is a refetch operation
                  refetchReason: reason
                }
              }),
              signal: AbortSignal.timeout(10000) // 10 second timeout
            });
            
            if (response.ok) {
              context.log(`[PIPELINE NOTIFICATION] ✓ Successfully notified pipeline service about lead refetch`);
              pipelineNotified = true;
              break;
            } else {
              const errorText = await response.text();
              context.warn(`[PIPELINE NOTIFICATION] Attempt ${httpAttempt + 1} failed: ${response.status} - ${errorText}`);
              if (httpAttempt < maxHttpRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, httpRetryDelays[httpAttempt]));
              }
            }
          } catch (httpError: any) {
            context.warn(`[PIPELINE NOTIFICATION] Attempt ${httpAttempt + 1} error: ${httpError.message}`);
            if (httpAttempt < maxHttpRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, httpRetryDelays[httpAttempt]));
            }
          }
        }
        
        if (!pipelineNotified) {
          context.warn(`[PIPELINE NOTIFICATION] Failed to notify pipeline service after ${maxHttpRetries} attempts. Event Grid might still deliver the event.`);
        }
      }
      
      // CRITICAL FIX: Immediately trigger quotation service to fetch plans
      // Add small delay to ensure status update propagates to frontend first
      context.log(`[IMMEDIATE TRIGGER] Waiting 1 second for status update to propagate...`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      
      const quotationGenUrl = process.env.QUOTATION_GEN_SERVICE_URL || 'https://quotation-gen-service-74e1210c.azurewebsites.net/api';
      context.log(`[IMMEDIATE TRIGGER] Triggering plan fetch for lead ${leadId} at ${quotationGenUrl}/plans/fetch`);
      
      try {
        const fetchResponse = await fetch(`${quotationGenUrl}/plans/fetch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-service-key': process.env.INTERNAL_SERVICE_KEY || ''
          },
          body: JSON.stringify({
            leadId: latestLead.id,
            lineOfBusiness: latestLead.lineOfBusiness,
            businessType: latestLead.businessType || 'individual',
            leadData: latestLead.lobData || {},
            forceRefresh: true,
            isRefetch: true // Flag to indicate this is a refetch operation
          }),
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });
        
        if (!fetchResponse.ok) {
          const errorText = await fetchResponse.text();
          context.error(`[IMMEDIATE TRIGGER] Failed to trigger plan fetch: ${fetchResponse.status} - ${errorText}`);
          // Don't throw - let Event Grid/Pipeline Service handle it as fallback
        } else {
          context.log(`[IMMEDIATE TRIGGER] ✓ Plan fetch triggered successfully for lead ${leadId}`);
        }
      } catch (triggerError: any) {
        context.warn(`[IMMEDIATE TRIGGER] Error triggering plan fetch: ${triggerError.message}. Event Grid/Pipeline Service will handle as fallback.`);
      }
      
      // Note: Immediate trigger above handles plan fetch. 
      // setTimeout delayed check removed since we trigger immediately.
      // Pipeline Service and Event Grid will handle status updates.
    } catch (eventError: any) {
      context.warn('Failed to publish lead.created event to Event Grid:', eventError.message);
      
      // HTTP Fallback: Trigger plan fetch directly if Event Grid fails
      // Also notify Pipeline Service if pipeline is active
      const quotationGenUrl = process.env.QUOTATION_GEN_SERVICE_URL || 'https://quotation-gen-service-74e1210c.azurewebsites.net/api';
      const maxHttpRetries = 3;
      const httpRetryDelays = [1000, 2000, 3000];
      let planFetchTriggered = false;
      
      // First, notify Pipeline Service if pipeline is active
      if (hasPipeline) {
        const pipelineServiceUrl = process.env.PIPELINE_SERVICE_URL || 'https://pipeline-service.azurewebsites.net/api';
        for (let httpAttempt = 0; httpAttempt < maxHttpRetries; httpAttempt++) {
          try {
            context.log(`[HTTP FALLBACK] Attempt ${httpAttempt + 1}/${maxHttpRetries}: Notifying pipeline service about lead refetch for lead ${leadId}`);
            
            const pipelineResponse = await fetch(`${pipelineServiceUrl}/events/process`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-service-key': process.env.INTERNAL_SERVICE_KEY || ''
              },
              body: JSON.stringify({
                eventType: 'lead.created',
                leadId: latestLead.id,
                lineOfBusiness: latestLead.lineOfBusiness,
                data: {
                  leadId: latestLead.id,
                  referenceId: latestLead.referenceId,
                  customerId: latestLead.customerId,
                  lineOfBusiness: latestLead.lineOfBusiness,
                  businessType: latestLead.businessType,
                  formId: latestLead.formId,
                  formData: latestLead.formData,
                  lobData: latestLead.lobData,
                  assignedTo: latestLead.assignedTo,
                  createdAt: latestLead.createdAt.toISOString(),
                  firstName: latestLead.firstName,
                  lastName: latestLead.lastName,
                  email: latestLead.email,
                  phone: latestLead.phone,
                  emirate: latestLead.emirate,
                  isRefetch: true,
                  refetchReason: reason
                }
              }),
              signal: AbortSignal.timeout(10000)
            });
            
            if (pipelineResponse.ok) {
              context.log(`[HTTP FALLBACK] ✓ Successfully notified pipeline service about lead refetch`);
              break;
            } else if (httpAttempt < maxHttpRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, httpRetryDelays[httpAttempt]));
            }
          } catch (pipelineError: any) {
            context.warn(`[HTTP FALLBACK] Pipeline notification attempt ${httpAttempt + 1} error: ${pipelineError.message}`);
            if (httpAttempt < maxHttpRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, httpRetryDelays[httpAttempt]));
            }
          }
        }
      }
      
      // Then, trigger plan fetch via Quotation Service
      for (let httpAttempt = 0; httpAttempt < maxHttpRetries; httpAttempt++) {
        try {
          context.log(`[HTTP FALLBACK] Attempt ${httpAttempt + 1}/${maxHttpRetries}: Triggering plan fetch at ${quotationGenUrl}/plans/fetch`);
          
          const response = await fetch(`${quotationGenUrl}/plans/fetch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              leadId: latestLead.id,
              lineOfBusiness: latestLead.lineOfBusiness,
              businessType: latestLead.businessType,
              leadData: latestLead.lobData || {}, // Use latest lobData
              forceRefresh: true
            }),
            signal: AbortSignal.timeout(10000)
          });
        
          if (response.ok) {
            context.log(`[HTTP FALLBACK] ✓ Plans refetch triggered successfully for lead ${leadId}`);
            planFetchTriggered = true;
            break;
          } else {
            const errorText = await response.text();
            context.warn(`[HTTP FALLBACK] Plan fetch attempt ${httpAttempt + 1} failed: ${response.status} - ${errorText}`);
            if (httpAttempt < maxHttpRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, httpRetryDelays[httpAttempt]));
            }
          }
        } catch (httpError: any) {
          context.warn(`[HTTP FALLBACK] Plan fetch attempt ${httpAttempt + 1} error: ${httpError.message}`);
          if (httpAttempt < maxHttpRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, httpRetryDelays[httpAttempt]));
          }
        }
      }
      
      if (!planFetchTriggered) {
        context.error(`[HTTP FALLBACK] Failed to trigger plan fetch after ${maxHttpRetries} attempts`);
      }
    }

    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Plans refetch triggered successfully',
        data: {
          lead: updatedLead
        }
      }
    });

  } catch (error: any) {
    context.error('Error refetching plans:', error);
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: error.message || 'Failed to refetch plans' 
      }
    });
  }
}

app.http('refetchPlans', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'leads/{leadId}/refetch-plans',
  handler: refetchPlans
});

