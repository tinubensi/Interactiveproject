/**
 * Manage Field Mappings Endpoint
 * PUT /api/manage/templates/{id}/field-mappings
 * Updates PDF field coordinate mappings for a template
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { ensureAuthorized, requirePermission, EMAF_PERMISSIONS } from '../../lib/auth';
import { withCors, handlePreflight } from '../../lib/corsHelper';
import { PdfFieldMapping } from '../../models/emafTypes';

interface UpdateFieldMappingsRequest {
  pdfFieldMappings: PdfFieldMapping[];
}

export async function manageFieldMappings(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    // TEMPORARY: Skip auth for testing
    // const userContext = await ensureAuthorized(request);
    // await requirePermission(userContext.userId, EMAF_PERMISSIONS.EMAF_CREATE);
    const userContext = { userId: 'dev-user-id' }; // Temporary bypass

    const templateId = request.params.id;
    const vendorId = request.query.get('vendorId');

    if (!templateId || !vendorId) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Template ID and Vendor ID are required'
        }
      });
    }

    // Get existing template
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

    const body: UpdateFieldMappingsRequest = await request.json() as UpdateFieldMappingsRequest;

    // Validate mappings
    if (!Array.isArray(body.pdfFieldMappings)) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Invalid mappings format. Expected array of PdfFieldMapping objects'
        }
      });
    }

    // Build a map of dataKey -> question for auto-populating questionId
    const questionByDataKey = new Map<string, any>();
    template.sections.forEach(section => {
      section.questions.forEach(q => {
        questionByDataKey.set(q.dataKey, q);
      });
    });

    // Validate and auto-populate each mapping
    const errors: string[] = [];
    body.pdfFieldMappings.forEach((mapping, index) => {
      // Auto-populate questionId if missing but dataKey is provided
      if (!mapping.questionId && mapping.questionDataKey) {
        const question = questionByDataKey.get(mapping.questionDataKey);
        if (question) {
          mapping.questionId = question.id;
          mapping.questionLabel = mapping.questionLabel || question.label;
        }
      }
      
      // Validate required fields
      if (!mapping.id || !mapping.questionId || !mapping.questionDataKey) {
        errors.push(`Mapping ${index + 1}: Missing required fields (id, questionId, questionDataKey)`);
      }
      if (typeof mapping.pdfPageNumber !== 'number' || mapping.pdfPageNumber < 1) {
        errors.push(`Mapping ${index + 1}: Invalid page number`);
      }
      if (typeof mapping.x !== 'number' || typeof mapping.y !== 'number') {
        errors.push(`Mapping ${index + 1}: Invalid coordinates`);
      }
    });

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

    // Verify that all mapped questions exist in the template
    const templateQuestionKeys = new Set<string>();
    template.sections.forEach(section => {
      section.questions.forEach(q => templateQuestionKeys.add(q.dataKey));
    });

    const unmappedKeys: string[] = [];
    body.pdfFieldMappings.forEach(mapping => {
      if (!templateQuestionKeys.has(mapping.questionDataKey)) {
        unmappedKeys.push(mapping.questionDataKey);
      }
    });

    if (unmappedKeys.length > 0) {
      context.warn(`Warning: Some mapped questions not found in template: ${unmappedKeys.join(', ')}`);
    }

    context.log(`Updating field mappings for template ${templateId}, count: ${body.pdfFieldMappings.length}`);

    // Update template with new mappings
    const currentMappingVersion = template.mappingVersion || 0;
    await cosmosService.updateEmafTemplate(templateId, vendorId, {
      pdfFieldMappings: body.pdfFieldMappings,
      mappingConfiguredAt: new Date(),
      mappingConfiguredBy: userContext.userId,
      mappingVersion: currentMappingVersion + 1,
      updatedAt: new Date(),
      updatedBy: userContext.userId
    });

    context.log('Field mappings updated successfully');

    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Field mappings updated successfully',
        data: {
          mappingCount: body.pdfFieldMappings.length,
          mappingVersion: currentMappingVersion + 1,
          warnings: unmappedKeys.length > 0 ? [`${unmappedKeys.length} mapped question(s) not found in template`] : []
        }
      }
    });
  } catch (error: any) {
    context.error('Manage field mappings error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to update mappings',
        details: error.message
      }
    });
  }
}

app.http('manageFieldMappings', {
  methods: ['PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'manage/templates/{id}/field-mappings',
  handler: manageFieldMappings
});
