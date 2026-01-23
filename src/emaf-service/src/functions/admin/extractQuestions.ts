/**
 * Extract Questions from PDF Endpoint
 * POST /api/manage/extract-questions
 * Accepts multipart form data with PDF file and returns suggested questions
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { pdfParserService } from '../../services/pdfParserService';
import { ensureAuthorized, requirePermission, EMAF_PERMISSIONS } from '../../lib/auth';
import { withCors, handlePreflight } from '../../lib/corsHelper';

export async function extractQuestions(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, EMAF_PERMISSIONS.EMAF_CREATE);

    // Get multipart form data
    const formData = await request.formData();
    const pdfFile = formData.get('file') as File;

    if (!pdfFile) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'No PDF file provided'
        }
      });
    }

    // Validate file type
    if (pdfFile.type !== 'application/pdf') {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Invalid file type. Only PDF files are accepted'
        }
      });
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (pdfFile.size > maxSize) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'File size exceeds maximum limit of 50MB'
        }
      });
    }

    context.log(`Extracting questions from PDF: ${pdfFile.name}`);

    // Convert File to Buffer
    const arrayBuffer = await pdfFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract form structure
    const extracted = await pdfParserService.extractFormStructure(buffer);

    context.log(`Extracted ${extracted.sections.length} sections with ${extracted.sections.reduce((sum, s) => sum + s.questions.length, 0)} questions`);
    context.log(`Extracted ${extracted.documentRequirements.length} document requirements`);
    context.log(`PDF has ${extracted.pageCount} pages`);

    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Questions extracted successfully',
        data: {
          sections: extracted.sections,
          documentRequirements: extracted.documentRequirements,
          pageCount: extracted.pageCount,
          totalQuestions: extracted.sections.reduce((sum, s) => sum + s.questions.length, 0)
        }
      }
    });
  } catch (error: any) {
    context.error('Extract questions error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to extract questions from PDF',
        details: error.message
      }
    });
  }
}

app.http('extractQuestions', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'manage/extract-questions',
  handler: extractQuestions
});
