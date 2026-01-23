/**
 * Publish EMAF Template
 * POST /api/admin/emaf/templates/{id}/publish
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { ensureAuthorized, requirePermission, EMAF_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, withCors } from '../../lib/corsHelper';

export async function publishEmafTemplate(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, EMAF_PERMISSIONS.EMAF_MANAGE);
    
    const templateId = request.params.id;
    const vendorId = request.query.get('vendorId');
    
    if (!templateId || !vendorId) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'templateId and vendorId are required'
        }
      });
    }
    
    const template = await cosmosService.getEmafTemplateById(templateId, vendorId);
    
    if (!template) {
      return withCors(request, {
        status: 404,
        jsonBody: { 
          success: false,
          error: 'EMAF template not found'
        }
      });
    }
    
    if (template.status === 'published') {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'Template is already published'
        }
      });
    }
    
    const updated = await cosmosService.updateEmafTemplate(templateId, vendorId, {
      status: 'published',
      updatedBy: userContext.userId
    });
    
    context.log(`Published EMAF template ${templateId}`);
    
    return withCors(request, {
      status: 200,
      jsonBody: { 
        success: true,
        message: 'EMAF template published successfully',
        data: updated
      }
    });
  } catch (error: any) {
    context.error('Publish EMAF template error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to publish EMAF template',
        details: error.message
      }
    });
  }
}

app.http('publishEmafTemplate', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'manage/templates/{id}/publish',
  handler: publishEmafTemplate
});
