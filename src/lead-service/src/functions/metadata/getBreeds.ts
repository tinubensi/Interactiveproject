/**
 * Get Breeds Function
 * Reference: Petli getBreeds controller
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { metadataService } from '../../services/metadataService';
import { ensureAuthorized, requirePermission, LEAD_PERMISSIONS } from '../../lib/auth';

export async function getBreeds(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, LEAD_PERMISSIONS.LEADS_READ);
    const body: any = await request.json();
    const { petTypeId, breedTypeId, search } = body;

    const breeds = await metadataService.getBreeds(petTypeId, breedTypeId, search);

    context.log(`Retrieved ${breeds.length} breeds`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          breeds
        }
      }
    };
  } catch (error: any) {
    context.error('Get breeds error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to retrieve breeds',
        details: error.message
      }
    };
  }
}

app.http('getBreeds', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'metadata/breeds',
  handler: getBreeds
});


