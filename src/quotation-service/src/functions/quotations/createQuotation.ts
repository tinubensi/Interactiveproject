/**
 * Create Quotation Function
 * Creates a quotation from selected plans
 * Reference: Petli saveQuotation logic
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { generateQuotationReferenceId } from '../../utils/referenceGenerator';
import { Quotation, QuotationPlan, CreateQuotationRequest } from '../../models/quotation';
import { handlePreflight, withCors } from '../../utils/corsHelper';
import { ensureAuthorized, requirePermission, QUOTATION_PERMISSIONS } from '../../lib/auth';

export async function createQuotation(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, QUOTATION_PERMISSIONS.QUOTES_CREATE);
    const body: CreateQuotationRequest = await request.json() as CreateQuotationRequest;

    if (!body.leadId || !body.customerId || !body.planIds || body.planIds.length === 0) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          error: 'leadId, customerId, and planIds are required'
        }
      });
    }

    // Fetch selected plans from Plan Service (or mock for now)
    const selectedPlans = await fetchPlansFromPlanService(body.planIds, body.leadId);
    
    if (selectedPlans.length === 0) {
      return withCors(request, {
        status: 404,
        jsonBody: {
          error: 'No plans found with provided IDs'
        }
      });
    }

    // Calculate total premium
    const totalPremium = selectedPlans.reduce((sum: number, plan: any) => sum + plan.annualPremium, 0);

    // Check if there's an existing current quotation - mark it as superseded
    const existingQuotation = await cosmosService.getCurrentQuotation(body.leadId);
    let version = 1;
    if (existingQuotation) {
      await cosmosService.markQuotationAsSuperseded(existingQuotation.id, existingQuotation.leadId);
      version = existingQuotation.version + 1;
    }

    // Create quotation
    const quotationId = uuidv4();
    const referenceId = await generateQuotationReferenceId();
    const validityDays = body.validityDays || 30;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validityDays);

    const quotation: Quotation = {
      id: quotationId,
      referenceId,
      leadId: body.leadId,
      customerId: body.customerId,
      planIds: body.planIds,
      lineOfBusiness: body.lineOfBusiness,
      businessType: body.businessType,
      totalPremium,
      currency: 'AED',
      validUntil,
      termsAndConditions: body.termsAndConditions || getDefaultTerms(body.lineOfBusiness),
      status: 'draft',
      isCurrentVersion: true,
      version,
      remarks: body.remarks,
      leadSnapshot: body.leadSnapshot, // Save customer info snapshot
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (existingQuotation) {
      quotation.previousVersionId = existingQuotation.id;
    }

    await cosmosService.createQuotation(quotation);

    // Create quotation plan snapshots
    const quotationPlans: QuotationPlan[] = selectedPlans.map((plan: any) => ({
      id: uuidv4(),
      quotationId,
      planId: plan.id,
      leadId: body.leadId,
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

    // Try to save quotation plans (optional if container doesn't exist yet)
    try {
      await cosmosService.createQuotationPlans(quotationPlans);
      context.log(`Saved ${quotationPlans.length} quotation plan snapshots`);
    } catch (planError: any) {
      context.warn(`Failed to save quotation plans (container may not exist): ${planError.message}`);
      // Continue anyway - quotation is still valid
    }

    // Publish event
    await eventGridService.publishQuotationCreated({
      quotationId,
      referenceId,
      leadId: body.leadId,
      customerId: body.customerId,
      lineOfBusiness: body.lineOfBusiness,
      totalPremium,
      planCount: quotationPlans.length,
      version,
      planIds: body.planIds
    });

    context.log(`Quotation created: ${referenceId} for lead ${body.leadId}`);

    return withCors(request, {
      status: 201,
      jsonBody: {
        success: true,
        message: 'Quotation created successfully',
        data: {
          quotation,
          plans: quotationPlans
        }
      }
    });
  } catch (error: any) {
    context.error('Create quotation error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to create quotation',
        details: error.message
      }
    });
  }
}

// Fetch actual plans from quotation-generation-service
async function fetchPlansFromPlanService(planIds: string[], leadId: string): Promise<any[]> {
  const QUOTATION_GEN_SERVICE_URL = process.env.QUOTATION_GEN_SERVICE_URL || 'http://localhost:7072/api';
  
  const plans: any[] = [];
  
  for (const planId of planIds) {
    try {
      const response = await fetch(`${QUOTATION_GEN_SERVICE_URL}/plans/${planId}?leadId=${leadId}`);
      
      if (response.ok) {
        const result = await response.json() as { success: boolean; data?: { plan: any } };
        if (result.success && result.data?.plan) {
          plans.push(result.data.plan);
        }
      } else {
        console.warn(`Failed to fetch plan ${planId}: ${response.status}`);
      }
    } catch (error) {
      console.error(`Error fetching plan ${planId}:`, error);
    }
  }
  
  return plans;
}

function getDefaultTerms(lob: string): string {
  return `
    This quotation is valid for 30 days from the date of issue.
    All terms and conditions are subject to the policy document.
    Premium amounts are subject to change based on underwriting review.
    Claim procedures must follow the standard process outlined in the policy.
  `.trim();
}

app.http('createQuotation', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'quotations',
  handler: createQuotation
});


