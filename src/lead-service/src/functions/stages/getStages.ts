/**
 * Get Stages Function
 * Retrieves all stages or stages for a specific LOB
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { ensureAuthorized, requirePermission, LEAD_PERMISSIONS } from '../../lib/auth';

export async function getStages(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, LEAD_PERMISSIONS.LEADS_READ);
    const lineOfBusiness = request.query.get('lineOfBusiness');

    let stages;
    if (lineOfBusiness) {
      // Get stages for specific LOB
      stages = await cosmosService.getStagesByLOB(lineOfBusiness);
      context.log(`Retrieved ${stages.length} stages for ${lineOfBusiness}`);
    } else {
      // Get all stages
      stages = await cosmosService.getAllStages();
      context.log(`Retrieved ${stages.length} stages`);
    }

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          stages
        }
      }
    };
  } catch (error: any) {
    context.error('Get stages error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to retrieve stages',
        details: error.message
      }
    };
  }
}

app.http('getStages', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'stages',
  handler: getStages
});

