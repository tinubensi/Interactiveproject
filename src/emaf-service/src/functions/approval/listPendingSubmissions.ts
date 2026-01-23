/**
 * List Pending Submissions (Staff)
 * GET /api/emaf/submissions/pending
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { ensureAuthorized, requirePermission, EMAF_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, withCors } from '../../lib/corsHelper';

export async function listPendingSubmissions(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    // TODO: Re-enable auth once staff authentication is properly set up
    // const userContext = await ensureAuthorized(request);
    // await requirePermission(userContext.userId, EMAF_PERMISSIONS.EMAF_APPROVE);
    
    context.log('=== List Pending Submissions Request ===');
    
    const limit = parseInt(request.query.get('limit') || '50');
    context.log(`Querying for pending submissions with limit: ${limit}`);
    
    const submissions = await cosmosService.listPendingSubmissions(limit);
    
    context.log(`✅ Found ${submissions.length} pending EMAF submissions`);
    if (submissions.length > 0) {
      context.log(`First submission ID: ${submissions[0].submissionId || submissions[0].id}`);
      context.log(`First submission status: ${submissions[0].status}`);
    }
    
    return withCors(request, {
      status: 200,
      jsonBody: { 
        success: true,
        data: submissions,
        count: submissions.length
      }
    });
  } catch (error: any) {
    context.error('❌ List pending submissions error:', error);
    context.error('Error stack:', error.stack);
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to list pending submissions',
        details: error.message,
        stack: error.stack
      }
    });
  }
}

app.http('listPendingSubmissions', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'emaf/submissions/pending',
  handler: listPendingSubmissions
});
