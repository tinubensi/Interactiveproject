/**
 * Get Breed Types Function
 * Reference: Petli getBreedTypes controller
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { metadataService } from '../../services/metadataService';

export async function getBreedTypes(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const body: any = await request.json();
    const { petTypeId } = body;

    const breedTypes = await metadataService.getBreedTypes(petTypeId);

    context.log(`Retrieved ${breedTypes.length} breed types`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          breedTypes
        }
      }
    };
  } catch (error: any) {
    context.error('Get breed types error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to retrieve breed types',
        details: error.message
      }
    };
  }
}

app.http('getBreedTypes', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'metadata/breed-types',
  handler: getBreedTypes
});


