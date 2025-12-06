/**
 * Save Plans Function
 * HTTP endpoint to save plans from quotation-generation-service
 * Fallback for when Event Grid is not available
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService, Plan } from '../../services/cosmosService';
import { handlePreflight, withCors } from '../../utils/corsHelper';

export async function savePlans(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const body = await request.json() as any;
    const leadId = request.params.leadId;

    if (!leadId || !body.plans) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'leadId and plans are required'
        }
      });
    }

    context.log(`Saving ${body.plans.length} plans for lead ${leadId}`);

    // Get the lead first to know its LOB (partition key)
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.id = @leadId AND c.type = "lead"',
      parameters: [{ name: '@leadId', value: leadId }]
    };

    const { resources: leads } = await cosmosService['leadsContainer'].items.query(querySpec).fetchAll();
    
    context.log(`Found ${leads.length} leads matching leadId ${leadId}`);
    
    if (leads.length === 0) {
      context.warn(`Lead ${leadId} not found, cannot save plans`);
      return withCors(request, {
        status: 404,
        jsonBody: {
          success: false,
          error: 'Lead not found'
        }
      });
    }

    const lead = leads[0];
    context.log(`Lead found: ${lead.id}, LOB: ${lead.lineOfBusiness}`);

    // Delete any existing plans for this lead (in case of re-fetch)
    try {
      await cosmosService.deletePlansForLead(leadId);
    } catch (deleteError) {
      context.warn('Error deleting existing plans (might be none):', deleteError);
    }
    
    // Save new plans
    context.log(`Attempting to save ${body.plans.length} plans...`);
    const savedPlans = await cosmosService.createPlans(body.plans);
    context.log(`Saved ${savedPlans.length} plans for lead ${leadId}`);
    
    if (savedPlans.length !== body.plans.length) {
      context.warn(`Only ${savedPlans.length} of ${body.plans.length} plans were saved successfully`);
    }

    // Update lead status to "Plans Available"
    await cosmosService.updateLead(leadId, lead.lineOfBusiness, {
      currentStage: 'Plans Available',
      stageId: 'stage-2',
      planFetchRequestId: body.fetchRequestId,
      plansCount: body.plans.length,
      updatedAt: new Date()
    });

    // Create timeline entry
    await cosmosService.createTimelineEntry({
      id: uuidv4(),
      leadId: leadId,
      stage: 'Plans Available',
      previousStage: lead.currentStage,
      stageId: 'stage-2',
      remark: `${body.plans.length} plans fetched from ${body.successfulVendors?.length || 0} vendors`,
      changedBy: 'system',
      changedByName: 'System',
      timestamp: new Date()
    });

    context.log(`Lead ${leadId} status updated to "Plans Available" with ${body.plans.length} plans`);

    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Plans saved successfully',
        data: {
          plansCount: savedPlans.length
        }
      }
    });
  } catch (error: any) {
    context.error('Save plans error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to save plans',
        details: error.message
      }
    });
  }
}

app.http('savePlans', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'leads/{leadId}/save-plans',
  handler: savePlans
});

