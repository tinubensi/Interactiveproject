/**
 * Create Policy Request Function
 * Reference: Petli policy issuance request creation
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { generatePolicyRequestReferenceId } from '../../utils/referenceGenerator';
import { PolicyRequest, CreatePolicyRequestDTO } from '../../models/policy';
import { ensureAuthorized, requirePermission, POLICY_PERMISSIONS } from '../../lib/auth';

export async function createPolicyRequest(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, POLICY_PERMISSIONS.POLICIES_CREATE);
    const body: CreatePolicyRequestDTO = await request.json() as CreatePolicyRequestDTO;

    if (!body.quotationId || !body.leadId || !body.customerId || !body.selectedPlanId) {
      return {
        status: 400,
        jsonBody: {
          error: 'quotationId, leadId, customerId, and selectedPlanId are required'
        }
      };
    }

    const policyRequest: PolicyRequest = {
      id: uuidv4(),
      referenceId: generatePolicyRequestReferenceId(),
      quotationId: body.quotationId,
      leadId: body.leadId,
      customerId: body.customerId,
      selectedPlanId: body.selectedPlanId,
      vendorId: body.vendorId,
      vendorName: body.vendorName,
      lineOfBusiness: body.lineOfBusiness,
      businessType: body.businessType,
      customerDocuments: [],
      lobSpecificDocuments: [],
      commonDocuments: [],
      status: 'pending',
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await cosmosService.createPolicyRequest(policyRequest);

    await eventGridService.publishPolicyRequestCreated({
      policyRequestId: policyRequest.id,
      referenceId: policyRequest.referenceId,
      quotationId: body.quotationId,
      leadId: body.leadId,
      customerId: body.customerId,
      vendorName: body.vendorName,
      lineOfBusiness: body.lineOfBusiness
    });

    context.log(`Policy request created: ${policyRequest.referenceId}`);

    return {
      status: 201,
      jsonBody: {
        success: true,
        message: 'Policy request created successfully',
        data: {
          policyRequest
        }
      }
    };
  } catch (error: any) {
    context.error('Create policy request error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to create policy request',
        details: error.message
      }
    };
  }
}

app.http('createPolicyRequest', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'policy-requests',
  handler: createPolicyRequest
});


