import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';

export async function getCustomer(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const id = request.params.id;

    if (!id) {
      return {
        status: 400,
        jsonBody: { error: 'Customer ID is required' },
      };
    }

    const customer = await cosmosService.getCustomerById(id);

    if (!customer) {
      return {
        status: 404,
        jsonBody: { error: 'Customer not found' },
      };
    }

    return {
      status: 200,
      jsonBody: customer,
    };
  } catch (error: any) {
    context.log('Get customer error:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error', message: error.message },
    };
  }
}

app.http('getCustomer', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'customers/{id}',
  handler: getCustomer,
});

