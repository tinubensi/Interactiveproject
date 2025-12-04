/**
 * List Leads Function
 * Lists leads with advanced pagination, filtering, and search
 * Reference: Petli leadsList controller
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { LeadListRequest } from '../../models/lead';
import { handlePreflight, withCors } from '../../utils/corsHelper';

export async function listLeads(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const body: LeadListRequest = await request.json() as LeadListRequest;

    // Set defaults
    const listRequest: LeadListRequest = {
      page: body.page || 1,
      limit: Math.min(body.limit || 20, 100), // Max 100 per page
      sortBy: body.sortBy || 'createdAt',
      sortOrder: body.sortOrder || 'desc',
      search: body.search,
      filters: body.filters || {},
      includeDeleted: body.includeDeleted || false,
      fieldsToReturn: body.fieldsToReturn
    };

    // Validate pagination
    if (listRequest.page < 1) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          error: 'Invalid page number. Must be >= 1'
        }
      });
    }

    if (listRequest.limit < 1 || listRequest.limit > 100) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          error: 'Invalid limit. Must be between 1 and 100'
        }
      });
    }

    // Query Cosmos DB
    const result = await cosmosService.listLeads(listRequest);

    context.log(`Listed ${result.data.length} leads (page ${result.pagination.page} of ${result.pagination.totalPages})`);

    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        ...result
      }
    });
  } catch (error: any) {
    context.error('List leads error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to list leads',
        details: error.message
      }
    });
  }
}

app.http('listLeads', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'leads/list',
  handler: listLeads
});


