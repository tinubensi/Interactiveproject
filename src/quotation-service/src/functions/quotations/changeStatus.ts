/**
 * Change Quotation Status Function
 * Reference: Petli changeQuotationStatus
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { ChangeStatusRequest, QuotationStatus } from '../../models/quotation';
import { ensureAuthorized, requirePermission, QUOTATION_PERMISSIONS } from '../../lib/auth';

export async function changeStatus(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, QUOTATION_PERMISSIONS.QUOTATIONS_UPDATE);
    const id = request.params.id;
    const body: Partial<ChangeStatusRequest> = await request.json() as Partial<ChangeStatusRequest>;
    const leadId = request.query.get('leadId');

    if (!id || !leadId) {
      return {
        status: 400,
        jsonBody: {
          error: 'Quotation ID and leadId are required'
        }
      };
    }

    if (!body.status) {
      return {
        status: 400,
        jsonBody: {
          error: 'status is required'
        }
      };
    }

    const quotation = await cosmosService.getQuotationById(id, leadId);

    if (!quotation) {
      return {
        status: 404,
        jsonBody: {
          error: 'Quotation not found'
        }
      };
    }

    const previousStatus = quotation.status;
    const updates: any = {
      status: body.status
    };

    // Handle status-specific fields
    if (body.status === 'approved') {
      updates.approvedAt = new Date();
    } else if (body.status === 'rejected') {
      updates.rejectedAt = new Date();
      if (body.reason) {
        updates.rejectionReason = body.reason;
      }
    } else if (body.status === 'sent') {
      if (!quotation.sentAt) {
        updates.sentAt = new Date();
      }
    }

    if (body.remarks) {
      updates.remarks = Object.assign({}, quotation.remarks || {}, body.remarks || {});
    }

    const updatedQuotation = await cosmosService.updateQuotation(id, leadId, updates);

    // Publish status changed event
    await eventGridService.publishQuotationStatusChanged({
      quotationId: id,
      leadId,
      previousStatus,
      newStatus: body.status,
      reason: body.reason
    });

    // Publish specific events
    if (body.status === 'approved') {
      const plans = await cosmosService.getQuotationPlans(id);
      const selectedPlan = plans.find(p => p.isSelected);
      
      await eventGridService.publishQuotationApproved({
        quotationId: id,
        leadId,
        customerId: quotation.customerId,
        selectedPlanId: selectedPlan?.id || plans[0]?.id || ''
      });
    } else if (body.status === 'rejected') {
      await eventGridService.publishQuotationRejected({
        quotationId: id,
        leadId,
        reason: body.reason
      });
    }

    context.log(`Quotation ${quotation.referenceId} status changed from ${previousStatus} to ${body.status}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Quotation status updated successfully',
        data: {
          quotation: updatedQuotation
        }
      }
    };
  } catch (error: any) {
    context.error('Change status error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to change quotation status',
        details: error.message
      }
    };
  }
}

app.http('changeStatus', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'quotations/{id}/status',
  handler: changeStatus
});

