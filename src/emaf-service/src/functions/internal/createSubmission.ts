/**
 * Create EMAF Submission (Internal)
 * POST /api/internal/submissions/create
 * Called by quotation-service when customer selects a plan
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { validateServiceKey } from '../../lib/auth';
import { handlePreflight, withCors } from '../../lib/corsHelper';
import { CreateSubmissionRequest } from '../../models/emafTypes';
import { v4 as uuidv4 } from 'uuid';

export async function createSubmission(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    // Validate service key for internal calls
    if (!validateServiceKey(request)) {
      return withCors(request, {
        status: 401,
        jsonBody: { 
          success: false,
          error: 'Unauthorized: Invalid service key'
        }
      });
    }
    
    const body: CreateSubmissionRequest = await request.json() as CreateSubmissionRequest;
    
    // Validate required fields
    if (!body.leadId || !body.quotationId || !body.vendorId) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'leadId, quotationId, and vendorId are required'
        }
      });
    }
    
    // Get EMAF template for vendor (must be published)
    const template = await cosmosService.getEmafTemplateByVendor(body.vendorId);
    
    if (!template || template.status !== 'published') {
      context.error('No published EMAF template found', {
        requestedVendorId: body.vendorId,
        templateStatus: template?.status,
        templateVendorId: template?.vendorId
      });
      return withCors(request, {
        status: 404,
        jsonBody: { 
          success: false,
          error: 'No published EMAF template found for this vendor',
          requestedVendorId: body.vendorId,
          suggestion: `Please ensure a template exists with vendorId "${body.vendorId}" and is published`
        }
      });
    }
    
    // Check if submission already exists for this quotation
    const existingSubmission = await cosmosService.getSubmissionByLeadAndQuotation(
      body.leadId,
      body.quotationId
    );

    if (existingSubmission) {
      context.log(`Found existing EMAF submission ${existingSubmission.submissionId} for quotation ${body.quotationId}`);
      
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const token = existingSubmission.id;
      const emafUrl = `${frontendUrl}/emaf/${token}`;
      
      return withCors(request, {
        status: 200,
        jsonBody: { 
          success: true,
          message: 'EMAF submission already exists',
          token: token,
          emafUrl: emafUrl,
          data: {
            submissionId: existingSubmission.id,
            displayId: existingSubmission.submissionId,
            template: template
          }
        }
      });
    }
    
    // Create submission
    const submissionId = uuidv4();
    const submission = {
      id: submissionId,
      submissionId: `EMAF-${Date.now()}-${submissionId.substring(0, 8).toUpperCase()}`,
      leadId: body.leadId,
      quotationId: body.quotationId,
      selectedPlanId: body.selectedPlanId,
      vendorId: body.vendorId,
      vendorCode: body.vendorCode,
      vendorName: body.vendorName,
      emafTemplateId: template.id,
      emafVersion: template.version,
      customerId: body.customerId,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      customerPhone: body.customerPhone,
      formData: {},
      uploadedDocuments: [],
      status: 'draft' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const created = await cosmosService.createSubmission(submission);
    
    // Publish event
    await eventGridService.publishSubmissionCreated({
      submissionId: created.submissionId,
      leadId: created.leadId,
      quotationId: created.quotationId,
      vendorId: created.vendorId,
      vendorName: created.vendorName,
      emafTemplateId: template.id,
      customerId: created.customerId,
      customerEmail: created.customerEmail
    });
    
    context.log(`Created EMAF submission ${created.submissionId} for lead ${body.leadId}`);
    
    // Generate token and URL for frontend redirect
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const token = created.id;
    const emafUrl = `${frontendUrl}/emaf/${token}`;
    
    return withCors(request, {
      status: 201,
      jsonBody: { 
        success: true,
        message: 'EMAF submission created successfully',
        token: token,
        emafUrl: emafUrl,
        data: {
          submissionId: created.id,
          displayId: created.submissionId,
          template: template
        }
      }
    });
  } catch (error: any) {
    context.error('Create submission error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to create EMAF submission',
        details: error.message
      }
    });
  }
}

app.http('createSubmission', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'internal/submissions/create',
  handler: createSubmission
});
