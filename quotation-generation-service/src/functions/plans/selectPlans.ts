/**
 * Select Plans Function
 * Marks plans as selected for quotation generation
 * Reference: Petli plan selection for quotation
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { SelectPlansRequest } from '../../models/plan';

export async function selectPlans(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const body: SelectPlansRequest = await request.json() as SelectPlansRequest;

    if (!body.leadId || !body.planIds || body.planIds.length === 0) {
      return {
        status: 400,
        jsonBody: {
          error: 'leadId and planIds are required'
        }
      };
    }

    // Validate maximum 5 plans
    if (body.planIds.length > 5) {
      return {
        status: 400,
        jsonBody: {
          error: 'Maximum 5 plans can be selected'
        }
      };
    }

    // Verify all plans exist
    for (const planId of body.planIds) {
      const plan = await cosmosService.getPlanById(planId, body.leadId);
      if (!plan) {
        return {
          status: 404,
          jsonBody: {
            error: `Plan not found: ${planId}`
          }
        };
      }
    }

    // Select plans (this will unselect all others)
    const selectedPlans = await cosmosService.selectPlans(body.leadId, body.planIds);

    // Publish plans.selected event
    await eventGridService.publishPlansSelected({
      leadId: body.leadId,
      planIds: body.planIds,
      selectedBy: 'user' // TODO: Get from auth context
    });

    context.log(`Selected ${selectedPlans.length} plans for lead ${body.leadId}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Plans selected successfully',
        data: {
          selectedPlans,
          count: selectedPlans.length
        }
      }
    };
  } catch (error: any) {
    context.error('Select plans error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to select plans',
        details: error.message
      }
    };
  }
}

app.http('selectPlans', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'plans/select',
  handler: selectPlans
});


