/**
 * List EMAF Templates
 * GET /api/admin/emaf/templates
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { ensureAuthorized, requirePermission, EMAF_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, withCors } from '../../lib/corsHelper';

export async function listEmafTemplates(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, EMAF_PERMISSIONS.EMAF_VIEW);
    
    const lineOfBusiness = request.query.get('lineOfBusiness') || undefined;
    const status = request.query.get('status') || undefined;
    const limit = parseInt(request.query.get('limit') || '50');
    
    const templates = await cosmosService.listEmafTemplates({
      lineOfBusiness,
      status,
      limit
    });
    
    return withCors(request, {
      status: 200,
      jsonBody: { 
        success: true,
        data: templates,
        count: templates.length
      }
    });
  } catch (error: any) {
    context.error('List EMAF templates error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to list EMAF templates',
        details: error.message
      }
    });
  }
}

app.http('listEmafTemplates', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'manage/templates',
  handler: listEmafTemplates
});
