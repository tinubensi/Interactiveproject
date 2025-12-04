/**
 * Get Gender Types Function
 * Reference: Petli getGenderTypes controller
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { metadataService } from '../../services/metadataService';
import { ensureAuthorized, requirePermission, LEAD_PERMISSIONS } from '../../lib/auth';

export async function getGenderTypes(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, LEAD_PERMISSIONS.LEADS_READ);
    const genderTypes = await metadataService.getGenderTypes();

    context.log(`Retrieved ${genderTypes.length} gender types`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          genderTypes
        }
      }
    };
  } catch (error: any) {
    context.error('Get gender types error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to retrieve gender types',
        details: error.message
      }
    };
  }
}

app.http('getGenderTypes', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'metadata/gender-types',
  handler: getGenderTypes
});


