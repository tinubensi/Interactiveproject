/**
 * List Pending Approvals API
 * GET /api/approvals/pending
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { listPendingApprovals } from '../../repositories/approvalRepository';
import { ensureAuthorized, requirePermission, PIPELINE_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, successResponse, errorResponse } from '../../utils/corsHelper';
import type { PredefinedApproverRole } from '../../models/pipeline';

async function handler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, PIPELINE_PERMISSIONS.APPROVALS_READ);

    // Parse query parameters
    const approverRole = request.query.get('approverRole') as PredefinedApproverRole | null;
    const pipelineId = request.query.get('pipelineId');
    const leadId = request.query.get('leadId');

    const approvals = await listPendingApprovals({
      approverRole: approverRole || undefined,
      pipelineId: pipelineId || undefined,
      leadId: leadId || undefined,
    });

    return successResponse(request, {
      approvals,
      count: approvals.length,
    });
  } catch (error: any) {
    context.error('List pending approvals error:', error);
    return errorResponse(request, error.message || 'Failed to list pending approvals', 500);
  }
}

app.http('ListPendingApprovals', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'approvals/pending',
  handler,
});

