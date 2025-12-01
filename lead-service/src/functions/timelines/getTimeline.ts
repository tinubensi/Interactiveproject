/**
 * Get Timeline Function
 * Retrieves timeline for a lead
 * Reference: Petli getTimeline controller
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { handlePreflight, withCors } from '../../utils/corsHelper';

export async function getTimeline(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const leadId = request.params.id;

    if (!leadId) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          error: 'Lead ID is required'
        }
      });
    }

    // Get timeline entries
    const timeline = await cosmosService.getLeadTimeline(leadId);

    context.log(`Retrieved ${timeline.length} timeline entries for lead ${leadId}`);

    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          leadId,
          timeline
        }
      }
    });
  } catch (error: any) {
    context.error('Get timeline error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to retrieve timeline',
        details: error.message
      }
    });
  }
}

app.http('getTimeline', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'leads/{id}/timeline',
  handler: getTimeline
});


