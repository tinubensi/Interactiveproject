import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { ensureAuthorized, requirePermission, CUSTOMER_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, withCors } from '../../lib/corsHelper';

export async function deleteCustomer(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, CUSTOMER_PERMISSIONS.CUSTOMERS_DELETE);
    
    const id = request.params.id;

    if (!id) {
      return withCors(request, {
        status: 400,
        jsonBody: { error: 'Customer ID is required' },
      });
    }

    const customer = await cosmosService.getCustomerById(id);

    if (!customer) {
      return withCors(request, {
        status: 404,
        jsonBody: { error: 'Customer not found' },
      });
    }

    // Delete from Cosmos DB
    await cosmosService.deleteCustomer(id);

    // Publish event
    await eventGridService.publishCustomerDeleted(customer);

    return withCors(request, {
      status: 200,
      jsonBody: { message: 'Customer deleted successfully' },
    });
  } catch (error: any) {
    context.log('Delete customer error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: { error: 'Internal server error', message: error.message },
    });
  }
}

app.http('deleteCustomer', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'customers/{id}',
  handler: deleteCustomer,
});
