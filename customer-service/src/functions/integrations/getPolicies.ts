import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

const POLICY_SERVICE_URL = process.env.POLICY_SERVICE_URL || 'http://localhost:7071/api';

export async function getPolicies(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const id = request.params.id;

    if (!id) {
      return {
        status: 400,
        jsonBody: { error: 'Customer ID is required' },
      };
    }

    // Call Policy Service
    const response = await fetch(`${POLICY_SERVICE_URL}/policies?customerId=${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          status: 200,
          jsonBody: [],
        };
      }
      throw new Error(`Policy service returned ${response.status}`);
    }

    const policies = await response.json();

    return {
      status: 200,
      jsonBody: policies,
    };
  } catch (error: any) {
    context.log('Get policies error:', error);
    // Return empty array if policy service is unavailable
    return {
      status: 200,
      jsonBody: [],
    };
  }
}

app.http('getPolicies', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'customers/{id}/policies',
  handler: getPolicies,
});

