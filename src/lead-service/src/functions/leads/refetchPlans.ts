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
    
    // Get the latest lead data to ensure we have the most recent lobData
    const latestLead = await cosmosService.getLeadById(leadId, lead.lineOfBusiness);
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
      context.log(`Lead ${leadId} is managed by pipeline - skipping stage update. Pipeline Service will handle stage progression.`);
      // Only update plan count, not stage - Pipeline Service controls stage progression
      updatedLead = await cosmosService.updateLead(leadId, latestLead.lineOfBusiness, {
        plansCount: 0,
        updatedAt: new Date()
      });
    } else {
      // No pipeline active - fallback to direct stage update (for legacy leads without pipelines)
      context.log(`Lead ${leadId} has no active pipeline - updating stage directly as fallback`);
      
      // Update lead status to "Plans Fetching"
      updatedLead = await cosmosService.updateLead(leadId, latestLead.lineOfBusiness, {
        currentStage: 'Plans Fetching',
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
        createdAt: latestLead.createdAt
      });
      eventPublished = true;
      context.log('lead.created event published successfully to Event Grid');
      
      // Delayed HTTP fallback check: Verify status was updated after Event Grid event
      if (eventPublished) {
        setTimeout(async () => {
          try {
            const leadServiceUrl = process.env.LEAD_SERVICE_URL || 'https://lead-service.azurewebsites.net/api';
            const leadCheckResponse = await fetch(`${leadServiceUrl}/leads/get/${leadId}?lineOfBusiness=${latestLead.lineOfBusiness}`);
            if (leadCheckResponse.ok) {
              const leadData: any = await leadCheckResponse.json();
              const currentLead = leadData.data?.lead || leadData;
              if (currentLead.currentStage === 'Plans Fetching') {
                context.warn(`Lead ${leadId} still in "Plans Fetching" after Event Grid event - using HTTP fallback`);
                
                // HTTP Fallback: Trigger plan fetch directly
                const quotationGenUrl = process.env.QUOTATION_GEN_SERVICE_URL || 'https://quotation-gen-service-74e1210c.azurewebsites.net/api';
                context.log(`Using HTTP fallback to trigger plan fetch at ${quotationGenUrl}/plans/fetch`);
                
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
                  })
                });
              
                if (!response.ok) {
                  const errorText = await response.text();
                  context.warn(`HTTP plan fetch trigger failed: ${response.status} - ${errorText}`);
                } else {
                  context.log(`Plans refetch triggered successfully for lead ${leadId} via HTTP fallback`);
                }
              } else {
                context.log(`Lead ${leadId} status updated successfully to "${currentLead.currentStage}" via Event Grid`);
              }
            }
          } catch (checkError: any) {
            context.warn('Status check failed, but Event Grid event was published:', checkError);
          }
        }, 5000); // 5 second delay
      }
    } catch (eventError: any) {
      context.warn('Failed to publish lead.created event to Event Grid:', eventError.message);
      
      // HTTP Fallback: Only trigger plan fetch directly if Event Grid fails
      try {
        const quotationGenUrl = process.env.QUOTATION_GEN_SERVICE_URL || 'https://quotation-gen-service-74e1210c.azurewebsites.net/api';
        context.log(`Event Grid failed, using HTTP fallback to trigger plan fetch at ${quotationGenUrl}/plans/fetch`);
        
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
          })
        });
      
        if (!response.ok) {
          const errorText = await response.text();
          context.warn(`HTTP plan fetch trigger failed: ${response.status} - ${errorText}`);
        } else {
          context.log(`Plans refetch triggered successfully for lead ${leadId} via HTTP fallback`);
        }
      } catch (httpError: any) {
        context.error('HTTP fallback to quotation-generation-service also failed:', httpError.message);
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

