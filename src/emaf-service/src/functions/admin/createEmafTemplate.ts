/**
 * Create EMAF Template
 * POST /api/admin/emaf/templates
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { ensureAuthorized, requirePermission, EMAF_PERMISSIONS } from '../../lib/auth';
import { validateEmafTemplate } from '../../lib/validation';
import { handlePreflight, withCors } from '../../lib/corsHelper';
import { CreateEmafTemplateRequest } from '../../models/emafTypes';
import { v4 as uuidv4 } from 'uuid';

export async function createEmafTemplate(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, EMAF_PERMISSIONS.EMAF_MANAGE);
    
    const body: CreateEmafTemplateRequest = await request.json() as CreateEmafTemplateRequest;
    
    // Validate required fields
    const validationErrors = validateEmafTemplate(body as any);
    if (validationErrors.length > 0) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'Validation failed',
          details: validationErrors
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
      vendorCode: body.vendorCode,
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
    
    context.log(`Created EMAF template for vendor ${body.vendorName}`);
    
    return withCors(request, {
      status: 201,
      jsonBody: { 
        success: true,
        message: 'EMAF template created successfully',
        data: created
      }
    });
  } catch (error: any) {
    context.error('Create EMAF template error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to create EMAF template',
        details: error.message
      }
    });
  }
}

app.http('createEmafTemplate', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'manage/templates',
  handler: createEmafTemplate
});
