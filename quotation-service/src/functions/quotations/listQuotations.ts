/**
 * List Quotations Function
 * Lists quotations with filtering and pagination
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { QuotationListRequest } from '../../models/quotation';

export async function listQuotations(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const body: QuotationListRequest = await request.json() as QuotationListRequest;

    // Set defaults
    const listRequest: QuotationListRequest = {
      leadId: body.leadId,
      customerId: body.customerId,
      page: body.page || 1,
      limit: Math.min(body.limit || 20, 100),
      sortBy: body.sortBy || 'createdAt',
      sortOrder: body.sortOrder || 'desc',
      filters: body.filters || {},
      search: body.search
    };

    // Query Cosmos DB
    const result = await cosmosService.listQuotations(listRequest);

    context.log(`Listed ${result.data.length} quotations`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        ...result
      }
    };
  } catch (error: any) {
    context.error('List quotations error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to list quotations',
        details: error.message
      }
    };
  }
}

app.http('listQuotations', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'quotations/list',
  handler: listQuotations
});


