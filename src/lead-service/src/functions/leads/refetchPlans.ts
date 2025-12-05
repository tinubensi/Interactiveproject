/**
 * Refetch Plans Endpoint
 * Triggers re-fetching of plans for an existing lead
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { withCors } from '../../utils/corsHelper';
import { v4 as uuidv4 } from 'uuid';

export async function refetchPlans(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const leadId = request.params.leadId;

    if (!leadId) {
      return withCors(request, {
        status: 400,
        jsonBody: { error: 'Lead ID is required' }
      });
    }

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
        jsonBody: { error: 'Lead not found' }
      });
    }

    const lead = leads[0];

    // Delete existing plans for this lead
    await cosmosService.deletePlansForLead(leadId);

    // Update lead status to "Plans Fetching"
    const updatedLead = await cosmosService.updateLead(leadId, lead.lineOfBusiness, {
      currentStage: 'Plans Fetching',
      stageId: 'stage-1',
      plansCount: 0,
      updatedAt: new Date()
    });

    // Create timeline entry
    await cosmosService.createTimelineEntry({
      id: uuidv4(),
      leadId: leadId,
      stage: 'Plans Fetching',
      previousStage: lead.currentStage,
      stageId: 'stage-1',
      remark: 'Plans refetch requested - fetching updated plans from vendors',
      changedBy: 'system',
      changedByName: 'System',
      timestamp: new Date()
    });

    // Publish lead.created event to trigger plan fetch
    // The quotation-generation-service listens for this event
    try {
      await eventGridService.publishLeadCreated({
        leadId: lead.id,
        referenceId: lead.referenceId,
        customerId: lead.customerId,
        lineOfBusiness: lead.lineOfBusiness,
        businessType: lead.businessType,
        formId: lead.formId,
        formData: lead.formData,
        lobData: lead.lobData,
        assignedTo: lead.assignedTo,
        createdAt: lead.createdAt
      });
      context.log(`Plans refetch triggered for lead ${leadId} via Event Grid`);
    } catch (eventError) {
      context.warn('Event Grid not available, triggering plan fetch via HTTP:', eventError);
      
      // Fallback: Directly call quotation-generation-service when Event Grid is unavailable
      try {
        const quotationGenUrl = process.env.QUOTATION_GEN_SERVICE_URL || 'http://localhost:7072/api';
        const response = await fetch(`${quotationGenUrl}/plans/fetch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            leadId: lead.id,
            lineOfBusiness: lead.lineOfBusiness,
            businessType: lead.businessType,
            leadData: lead.lobData || {},
            forceRefresh: true
          })
        });
        
        if (!response.ok) {
          context.warn('Failed to trigger plan fetch via HTTP fallback');
        } else {
          context.log(`Plans refetch triggered for lead ${leadId} via HTTP fallback`);
        }
      } catch (httpError) {
        context.error('HTTP fallback to quotation-generation-service failed:', httpError);
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
      jsonBody: { error: error.message || 'Failed to refetch plans' }
    });
  }
}

app.http('refetchPlans', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'leads/{leadId}/refetch-plans',
  handler: refetchPlans
});

