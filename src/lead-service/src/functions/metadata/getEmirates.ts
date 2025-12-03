/**
 * Get Emirates Function
 * Reference: Petli getEmirates controller
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { metadataService } from '../../services/metadataService';

export async function getEmirates(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const emirates = await metadataService.getEmirates();

    context.log(`Retrieved ${emirates.length} emirates`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          emirates
        }
      }
    };
  } catch (error: any) {
    context.error('Get emirates error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to retrieve emirates',
        details: error.message
      }
    };
  }
}

app.http('getEmirates', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'metadata/emirates',
  handler: getEmirates
});


