/**
 * Revise Quotation Function
 * Creates a new version of an existing quotation
 * Reference: Petli reviseQuotation logic
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { generateRevisionReferenceId } from '../../utils/referenceGenerator';
import { Quotation, QuotationPlan, QuotationRevision, ReviseQuotationRequest } from '../../models/quotation';
import { ensureAuthorized, requirePermission, QUOTATION_PERMISSIONS } from '../../lib/auth';

export async function reviseQuotation(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, QUOTATION_PERMISSIONS.QUOTES_UPDATE);
    const id = request.params.id;
    const body: Partial<ReviseQuotationRequest> = await request.json() as Partial<ReviseQuotationRequest>;
    const leadId = request.query.get('leadId');

    if (!id || !leadId) {
      return {
        status: 400,
        jsonBody: {
          error: 'Quotation ID and leadId are required'
        }
      };
    }

    if (!body.planIds || body.planIds.length === 0) {
      return {
        status: 400,
        jsonBody: {
          error: 'planIds are required for revision'
        }
      };
    }

    const originalQuotation = await cosmosService.getQuotationById(id, leadId);

    if (!originalQuotation) {
      return {
        status: 404,
        jsonBody: {
          error: 'Original quotation not found'
        }
      };
    }

    // Mark original as superseded
    await cosmosService.markQuotationAsSuperseded(id, leadId);

    // Fetch new plans
    const selectedPlans = await fetchPlansFromPlanService(body.planIds, leadId);
    const totalPremium = selectedPlans.reduce((sum: number, plan: any) => sum + plan.annualPremium, 0);

    // Create new quotation version
    const newQuotationId = uuidv4();
    const newVersion = originalQuotation.version + 1;
    const newReferenceId = generateRevisionReferenceId(originalQuotation.referenceId, newVersion);

    const revisedQuotation: Quotation = {
      ...originalQuotation,
      id: newQuotationId,
      referenceId: newReferenceId,
      planIds: body.planIds,
      totalPremium,
      version: newVersion,
      previousVersionId: originalQuotation.id,
      isCurrentVersion: true,
      status: 'draft',
      sentAt: undefined,
      approvedAt: undefined,
      rejectedAt: undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await cosmosService.createQuotation(revisedQuotation);

    // Create new quotation plan snapshots
    const quotationPlans: QuotationPlan[] = selectedPlans.map((plan: any) => ({
      id: uuidv4(),
      quotationId: newQuotationId,
      planId: plan.id,
      leadId,
      vendorId: plan.vendorId,
      vendorName: plan.vendorName,
      vendorCode: plan.vendorCode,
      planName: plan.planName,
      planCode: plan.planCode,
      planType: plan.planType,
      annualPremium: plan.annualPremium,
      monthlyPremium: plan.monthlyPremium,
      currency: plan.currency,
      annualLimit: plan.annualLimit,
      deductible: plan.deductible,
      deductibleMetric: plan.deductibleMetric,
      coInsurance: plan.coInsurance,
      coInsuranceMetric: plan.coInsuranceMetric,
      waitingPeriod: plan.waitingPeriod,
      waitingPeriodMetric: plan.waitingPeriodMetric,
      fullPlanData: plan,
      isSelected: false,
      createdAt: new Date()
    }));

    await cosmosService.createQuotationPlans(quotationPlans);

    // Track revision
    const plansAdded = body.planIds.filter(pid => !originalQuotation.planIds.includes(pid));
    const plansRemoved = originalQuotation.planIds.filter(pid => !body.planIds!.includes(pid));

    const revision: QuotationRevision = {
      id: uuidv4(),
      quotationId: newQuotationId,
      previousQuotationId: originalQuotation.id,
      leadId,
      version: newVersion,
      changes: body.changes || [],
      plansAdded,
      plansRemoved,
      reason: body.reason || 'Quotation revised',
      remarks: body.remarks,
      revisedAt: new Date()
    };

    await cosmosService.createRevision(revision);

    // Publish event
    await eventGridService.publishQuotationRevised({
      quotationId: newQuotationId,
      previousQuotationId: originalQuotation.id,
      leadId,
      version: newVersion,
      reason: body.reason || 'Quotation revised',
      plansChanged: plansAdded.length > 0 || plansRemoved.length > 0
    });

    context.log(`Quotation revised: ${newReferenceId} (version ${newVersion})`);

    return {
      status: 201,
      jsonBody: {
        success: true,
        message: 'Quotation revised successfully',
        data: {
          quotation: revisedQuotation,
          plans: quotationPlans,
          revision
        }
      }
    };
  } catch (error: any) {
    context.error('Revise quotation error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to revise quotation',
        details: error.message
      }
    };
  }
}

// Mock function - will be replaced with actual API call
async function fetchPlansFromPlanService(planIds: string[], leadId: string): Promise<any[]> {
  return planIds.map((id, index) => ({
    id,
    leadId,
    vendorId: `vendor-${index + 1}`,
    vendorName: `Vendor ${index + 1}`,
    vendorCode: `V${index + 1}`,
    planName: `Plan ${index + 1}`,
    planCode: `P${index + 1}`,
    planType: 'premium',
    annualPremium: 2000 + (index * 500),
    monthlyPremium: 180 + (index * 45),
    currency: 'AED',
    annualLimit: 100000,
    deductible: 250,
    coInsurance: 10,
    waitingPeriod: 7,
    benefits: [],
    exclusions: []
  }));
}

app.http('reviseQuotation', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'quotations/{id}/revise',
  handler: reviseQuotation
});

