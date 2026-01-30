import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { ensureAuthorized, requirePermission, CUSTOMER_PERMISSIONS } from '../../lib/auth';
import { CustomerListRequest } from '../../types/customer';

export async function listCustomers(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('HTTP trigger function processed a request to list customers.');

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, CUSTOMER_PERMISSIONS.CUSTOMERS_READ);
    
    // Parse request body
    const body = await request.json() as any;
    
    // Build list request with defaults
    const listRequest: CustomerListRequest = {
      page: body.page || 1,
      limit: body.limit || 10,
      sortBy: body.sortBy || 'createdAt',
      sortOrder: body.sortOrder || 'desc',
      search: body.search,
      filters: body.filters,
    };
    
    // Validate pagination
    if (listRequest.page < 1) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid page number. Page must be >= 1.' },
      };
    }
    
    if (listRequest.limit < 1 || listRequest.limit > 100) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid limit. Limit must be between 1 and 100.' },
      };
    }
    
    // Get paginated customers
    const result = await cosmosService.listCustomers(listRequest);
    
    context.log(`Found ${result.data.length} customers (page ${result.pagination.page} of ${result.pagination.totalPages})`);

    return {
      status: 200,
      jsonBody: result,
    };
  } catch (error) {
    context.log('Error listing customers:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to list customers',
      },
    };
  }
}

app.http('listCustomers', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'customers',
  handler: listCustomers,
});

