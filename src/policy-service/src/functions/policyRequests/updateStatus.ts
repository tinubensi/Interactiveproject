/**
 * Update Policy Request Status Function
 * Approve or reject policy request
 * Reference: Petli updateRequestStatus
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { generatePolicyNumber } from '../../utils/referenceGenerator';
import { UpdatePolicyRequestStatusDTO, Policy } from '../../models/policy';

export async function updateStatus(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const id = request.params.id;
    const quotationId = request.query.get('quotationId');
    const body: UpdatePolicyRequestStatusDTO = await request.json() as UpdatePolicyRequestStatusDTO;

    if (!id || !quotationId) {
      return {
        status: 400,
        jsonBody: {
          error: 'Policy request ID and quotationId are required'
        }
      };
    }

    const policyRequest = await cosmosService.getPolicyRequestById(id, quotationId);

    if (!policyRequest) {
      return {
        status: 404,
        jsonBody: {
          error: 'Policy request not found'
        }
      };
    }

    const updates: any = {
      status: body.status,
      remarks: body.remarks,
      reviewedAt: new Date(),
      reviewedBy: body.reviewedBy
    };

    if (body.status === 'approved') {
      updates.approvedAt = new Date();

      // Create issued policy
      const policy: Policy = {
        id: uuidv4(),
        policyNumber: generatePolicyNumber(),
        customerId: policyRequest.customerId,
        leadId: policyRequest.leadId,
        quotationId: policyRequest.quotationId,
        policyRequestId: policyRequest.id,
        planId: policyRequest.selectedPlanId,
        vendorId: policyRequest.vendorId,
        vendorName: policyRequest.vendorName,
        vendorCode: '', // TODO: Get from plan
        lineOfBusiness: policyRequest.lineOfBusiness,
        businessType: policyRequest.businessType,
        planName: 'Plan Name', // TODO: Get from plan
        planType: 'premium',
        annualPremium: 2000, // TODO: Get from plan
        monthlyPremium: 180,
        currency: 'AED',
        annualLimit: 100000,
        deductible: 250,
        coInsurance: 10,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        issueDate: new Date(),
        status: 'active',
        isRenewable: true,
        fullPlanData: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await cosmosService.createPolicy(policy);

      updates.issuedAt = new Date();
      updates.policyId = policy.id;
      updates.policyNumber = policy.policyNumber;
      updates.status = 'issued';

      // Publish policy issued event
      await eventGridService.publishPolicyIssued({
        policyId: policy.id,
        policyNumber: policy.policyNumber,
        policyRequestId: policyRequest.id,
        quotationId: policyRequest.quotationId,
        leadId: policyRequest.leadId,
        customerId: policyRequest.customerId,
        vendorName: policyRequest.vendorName,
        lineOfBusiness: policyRequest.lineOfBusiness,
        startDate: policy.startDate,
        endDate: policy.endDate,
        annualPremium: policy.annualPremium
      });

      // Publish request approved event
      await eventGridService.publishPolicyRequestApproved({
        policyRequestId: policyRequest.id,
        quotationId: policyRequest.quotationId,
        leadId: policyRequest.leadId,
        customerId: policyRequest.customerId,
        approvedBy: body.reviewedBy || 'system'
      });
    } else if (body.status === 'rejected') {
      updates.rejectedAt = new Date();
      updates.rejectionReason = body.rejectionReason;

      await eventGridService.publishPolicyRequestRejected({
        policyRequestId: policyRequest.id,
        quotationId: policyRequest.quotationId,
        leadId: policyRequest.leadId,
        reason: body.rejectionReason || 'Rejected by underwriter',
        rejectedBy: body.reviewedBy || 'system'
      });
    }

    const updatedRequest = await cosmosService.updatePolicyRequest(id, quotationId, updates);

    context.log(`Policy request ${policyRequest.referenceId} status changed to ${body.status}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Policy request status updated successfully',
        data: {
          policyRequest: updatedRequest,
          policy: updates.policyId ? { id: updates.policyId, number: updates.policyNumber } : undefined
        }
      }
    };
  } catch (error: any) {
    context.error('Update status error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to update status',
        details: error.message
      }
    };
  }
}

app.http('updateStatus', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'policy-requests/{id}/status',
  handler: updateStatus
});


