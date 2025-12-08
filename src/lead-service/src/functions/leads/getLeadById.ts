/**
 * Get Lead By ID Function
 * Retrieves a single lead by ID
 * Reference: Petli getLeadById controller
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { handlePreflight, withCors } from '../../utils/corsHelper';

export async function getLeadById(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const id = request.params.id;
    const lineOfBusiness = request.query.get('lineOfBusiness');

    if (!id) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Lead ID is required'
        }
      });
    }

    let lead: any = null;

    // If lineOfBusiness is provided, use direct partition key lookup (faster)
    if (lineOfBusiness) {
      lead = await cosmosService.getLeadById(id, lineOfBusiness);
    } else {
      // If not provided, query across partitions to find the lead
      lead = await cosmosService.getLeadByIdWithoutPartition(id);
    }

    // Get lead from Cosmos DB

    if (!lead) {
      return withCors(request, {
        status: 404,
        jsonBody: {
          success: false,
          error: 'Lead not found'
        }
      });
    }

    // Check if soft deleted
    if (lead.deletedAt) {
      return withCors(request, {
        status: 410,
        jsonBody: {
          success: false,
          error: 'Lead has been deleted',
          deletedAt: lead.deletedAt
        }
      });
    }

    // Get timeline
    const timeline = await cosmosService.getLeadTimeline(id);

    context.log(`Retrieved lead: ${lead.referenceId}`);

    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          lead,
          timeline
        }
      }
    });
  } catch (error: any) {
    context.error('Get lead by ID error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to retrieve lead',
        details: error.message
      }
    });
  }
}

app.http('getLeadById', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'leads/get/{id}',
  handler: getLeadById
});


