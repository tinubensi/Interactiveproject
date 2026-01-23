/**
 * Update EMAF Template
 * PUT /api/admin/emaf/templates/{id}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { ensureAuthorized, requirePermission, EMAF_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, withCors } from '../../lib/corsHelper';
import { UpdateEmafTemplateRequest } from '../../models/emafTypes';

export async function updateEmafTemplate(
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
    
    const body: UpdateEmafTemplateRequest = await request.json() as UpdateEmafTemplateRequest;
    
    const updates = {
      ...body,
      updatedAt: new Date(),
      updatedBy: userContext.userId,
    };
    
    const updated = await cosmosService.updateEmafTemplate(templateId, vendorId, updates);
    
    context.log(`Updated EMAF template ${templateId}`);
    
    return withCors(request, {
      status: 200,
      jsonBody: { 
        success: true,
        message: 'EMAF template updated successfully',
        data: updated
      }
    });
  } catch (error: any) {
    context.error('Update EMAF template error:', error);
    
    if (error.message.includes('not found')) {
      return withCors(request, {
        status: 404,
        jsonBody: { 
          success: false,
          error: error.message
        }
      });
    }
    
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to update EMAF template',
        details: error.message
      }
    });
  }
}

app.http('updateEmafTemplate', {
  methods: ['PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'manage/templates/{id}',
  handler: updateEmafTemplate
});
