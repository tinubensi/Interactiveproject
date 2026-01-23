/**
 * Get EMAF for Token (Customer)
 * GET /api/customer/emaf/{token}
 * Returns EMAF template and submission for customer to fill
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { handlePreflight, withCors } from '../../lib/corsHelper';

export async function getEmafForToken(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const token = request.params.token;
    
    if (!token) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'Token is required'
        }
      });
    }
    
    // Token is the submission ID - get submission directly
    const submission = await cosmosService.getSubmissionById(token);
    
    if (!submission) {
      return withCors(request, {
        status: 404,
        jsonBody: { 
          success: false,
          error: 'EMAF submission not found'
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
          error: 'EMAF template not found'
        }
      });
    }
    
    return withCors(request, {
      status: 200,
      jsonBody: { 
        success: true,
        data: {
          submission,
          template
        }
      }
    });
  } catch (error: any) {
    context.error('Get EMAF for token error:', error);
    
    if (error.response?.status === 404) {
      return withCors(request, {
        status: 404,
        jsonBody: { 
          success: false,
          error: 'Quotation not found or link expired'
        }
      });
    }
    
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to get EMAF',
        details: error.message
      }
    });
  }
}

app.http('getEmafForToken', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'customer/emaf/{token}',
  handler: getEmafForToken
});
