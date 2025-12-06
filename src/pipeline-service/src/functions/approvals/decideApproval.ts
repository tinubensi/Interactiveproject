/**
 * Decide Approval API
 * POST /api/approvals/:id/decide
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getApproval, ApprovalNotFoundError } from '../../repositories/approvalRepository';
import { handleApprovalDecision } from '../../lib/orchestrator';
import { ensureAuthorized, requirePermission, PIPELINE_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, successResponse, errorResponse, notFoundResponse, badRequestResponse } from '../../utils/corsHelper';
import { publishApprovalDecided } from '../../services/eventGridService';
import type { ApprovalDecisionRequest } from '../../models/pipeline';

async function handler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, PIPELINE_PERMISSIONS.APPROVALS_DECIDE);

    const approvalId = request.params.id;
    if (!approvalId) {
      return errorResponse(request, 'Approval ID is required', 400);
    }

    const body = await request.json() as ApprovalDecisionRequest;

    if (!body.decision || !['approved', 'rejected'].includes(body.decision)) {
      return badRequestResponse(request, 'decision must be "approved" or "rejected"');
    }

    context.log(`Processing approval decision: ${approvalId} - ${body.decision}`);

    // Verify approval exists and is pending
    const approval = await getApproval(approvalId);
    if (approval.status !== 'pending') {
      return badRequestResponse(request, `Approval is not pending (status: ${approval.status})`);
    }

    // Process the decision
    const result = await handleApprovalDecision(
      approvalId,
      body.decision,
      userContext.userId,
      userContext.name,
      body.comment,
      context.log.bind(context)
    );

    if (!result.processed) {
      return errorResponse(request, result.error || 'Failed to process approval', 500);
    }

    // Publish approval decided event
    await publishApprovalDecided({
      approvalId,
      instanceId: approval.instanceId,
      leadId: approval.leadId,
      decision: body.decision,
      decidedBy: userContext.userId,
    });

    return successResponse(request, {
      message: `Approval ${body.decision}`,
      approvalId,
      decision: body.decision,
      instanceId: result.instanceId,
      action: result.action,
    });
  } catch (error: any) {
    if (error instanceof ApprovalNotFoundError) {
      return notFoundResponse(request, 'Approval');
    }
    context.error('Decide approval error:', error);
    return errorResponse(request, error.message || 'Failed to decide approval', 500);
  }
}

app.http('DecideApproval', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'approvals/{id}/decide',
  handler,
});

