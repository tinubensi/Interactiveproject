import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';

export async function listCustomers(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('HTTP trigger function processed a request to list customers.');

  try {
    // Get query parameters for pagination (optional)
    const limit = request.query.get('limit') || '100';
    const offset = request.query.get('offset') || '0';

    // Query all customers
    const query = 'SELECT * FROM c ORDER BY c._ts DESC';
    const customers = await cosmosService.queryCustomers(query);

    context.log(`Found ${customers.length} customers`);

    return {
      status: 200,
      jsonBody: {
        customers,
        total: customers.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
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
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'customers',
  handler: listCustomers,
});

