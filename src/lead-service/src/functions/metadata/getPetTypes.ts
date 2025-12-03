/**
 * Get Pet Types Function
 * Reference: Petli getPetTypes controller
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { metadataService } from '../../services/metadataService';

export async function getPetTypes(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const petTypes = await metadataService.getPetTypes();

    context.log(`Retrieved ${petTypes.length} pet types`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          petTypes
        }
      }
    };
  } catch (error: any) {
    context.error('Get pet types error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to retrieve pet types',
        details: error.message
      }
    };
  }
}

app.http('getPetTypes', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'metadata/pet-types',
  handler: getPetTypes
});


