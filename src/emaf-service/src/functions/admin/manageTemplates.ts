/**
 * Manage EMAF Templates (Combined Handler)
 * GET /api/manage/templates - List all templates
 * POST /api/manage/templates - Create new template
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { ensureAuthorized, requirePermission, EMAF_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, withCors } from '../../lib/corsHelper';
import { v4 as uuidv4 } from 'uuid';

export async function manageTemplates(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    
    // Handle GET - List templates
    if (request.method === 'GET') {
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
    }
    
    // Handle POST - Create template
    if (request.method === 'POST') {
      await requirePermission(userContext.userId, EMAF_PERMISSIONS.EMAF_CREATE);
      
      const body = await request.json() as any;
      
      // Validation
      const errors: string[] = [];
      if (!body.vendorId) errors.push('vendorId is required');
      if (!body.vendorName) errors.push('vendorName is required');
      if (!body.name) errors.push('name is required');
      if (!body.sections || !Array.isArray(body.sections) || body.sections.length === 0) {
        errors.push('At least one section is required');
      }
      
      if (errors.length > 0) {
        return withCors(request, {
          status: 400,
          jsonBody: { 
            success: false,
            error: 'Validation failed',
            details: errors
          }
        });
      }
      
      // Check if EMAF already exists for vendor
      const existing = await cosmosService.getEmafTemplateByVendor(body.vendorId);
      if (existing && existing.status !== 'archived') {
        return withCors(request, {
          status: 409,
          jsonBody: { 
            success: false,
            error: 'EMAF template already exists for this vendor',
            existingTemplateId: existing.id
          }
        });
      }
      
      const template = {
        id: uuidv4(),
        emafId: `emaf-${body.vendorCode || body.vendorId}-${Date.now()}`,
        vendorId: body.vendorId,
        vendorCode: body.vendorCode || body.vendorId,
        vendorName: body.vendorName,
        lineOfBusiness: body.lineOfBusiness || 'medical',
        name: body.name,
        description: body.description,
        sections: body.sections,
        requiredDocuments: body.requiredDocuments || [],
        pdfFieldMappings: [], // Will be configured later through mapping UI
        status: 'draft' as const,
        version: 1,
        createdAt: new Date(),
        createdBy: userContext.userId,
        updatedAt: new Date(),
        updatedBy: userContext.userId,
        isDeleted: false
      };
      
      const created = await cosmosService.createEmafTemplate(template);
      
      return withCors(request, {
        status: 201,
        jsonBody: {
          success: true,
          message: 'EMAF template created successfully',
          data: created
        }
      });
    }
    
    // Method not allowed
    return withCors(request, {
      status: 405,
      jsonBody: {
        success: false,
        error: 'Method not allowed'
      }
    });
    
  } catch (error: any) {
    context.error('Manage templates error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to manage templates',
        details: error.message
      }
    });
  }
}

app.http('manageTemplates', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'manage/templates',
  handler: manageTemplates
});
