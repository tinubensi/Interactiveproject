/**
 * Render EMAF HTML (Customer)
 * GET /api/customer/emaf/{token}/render-html
 * 
 * Renders the Handlebars template to HTML without generating PDF
 * This allows frontend to generate PDF client-side using html2canvas + jsPDF
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { templateRenderer } from '../../services/templateRenderer';
import { handlePreflight, withCors } from '../../lib/corsHelper';

export async function renderEmafHtml(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const submissionId = request.params.token; // token is the submissionId
    const leadId = request.query.get('leadId');
    
    if (!submissionId || !leadId) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'submissionId and leadId are required'
        }
      });
    }
    
    context.log(`🔄 Rendering HTML for submission ${submissionId}`);
    
    // Get submission
    const submission = await cosmosService.getSubmission(submissionId, leadId);
    
    if (!submission) {
      return withCors(request, {
        status: 404,
        jsonBody: { 
          success: false,
          error: 'Submission not found'
        }
      });
    }
    
    // Get template
    const template = await cosmosService.getEmafTemplateById(
      submission.emafTemplateId,
      submission.vendorId
    );
    
    if (!template) {
      return withCors(request, {
        status: 404,
        jsonBody: { 
          success: false,
          error: 'Template not found'
        }
      });
    }
    
    context.log(`📄 Template: ${template.name}`);
    context.log(`📝 Form data keys: ${Object.keys(submission.formData || {}).length}`);
    
    // Render HTML template (no browser needed)
    context.log('🎨 Rendering HTML template...');
    const html = await templateRenderer.renderTemplate(
      template.vendorCode,
      submission.formData
    );
    
    context.log(`✅ HTML rendered successfully (${html.length} characters)`);
    
    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        html: html
      }
    });
  } catch (error: any) {
    context.error('❌ HTML rendering failed:', error);
    context.error('Error stack:', error.stack);
    
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to render HTML',
        details: error.message
      }
    });
  }
}

app.http('renderEmafHtml', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'customer/emaf/{token}/render-html',
  handler: renderEmafHtml
});
