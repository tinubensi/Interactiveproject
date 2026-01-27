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
import { notifyPipelineService } from '../../utils/pipelineFallback';

export async function createQuotation(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, QUOTATION_PERMISSIONS.QUOTATIONS_CREATE);
    const body: CreateQuotationRequest = await request.json() as CreateQuotationRequest;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/1d4bfb26-61e5-4cd1-bed5-3fc2ec2611a5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'createQuotation.ts:30',message:'createQuotation request received',data:{leadId:body.leadId,customerId:body.customerId,planIds:body.planIds,planCount:body.planIds?.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
    // #endregion

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
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/1d4bfb26-61e5-4cd1-bed5-3fc2ec2611a5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'createQuotation.ts:44',message:'Plans fetched from service',data:{requestedPlanIds:body.planIds,fetchedPlansCount:selectedPlans.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,E'})}).catch(()=>{});
    // #endregion
    
    if (selectedPlans.length === 0) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1d4bfb26-61e5-4cd1-bed5-3fc2ec2611a5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'createQuotation.ts:50',message:'ERROR: No plans found - returning 404',data:{requestedPlanIds:body.planIds,leadId:body.leadId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,E'})}).catch(()=>{});
      // #endregion
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

    // HTTP Fallback: Also notify pipeline service directly
    try {
      await notifyPipelineService('quotation.created', {
        leadId: body.leadId,
        quotationId,
        referenceId,
        customerId: body.customerId,
        lineOfBusiness: body.lineOfBusiness,
        totalPremium,
        planCount: quotationPlans.length,
        version,
        planIds: body.planIds,
      }, { log: context.log.bind(context) });
    } catch (fallbackError) {
      context.warn(`[HTTP Fallback] Failed to notify pipeline service: ${fallbackError}`);
    }

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

// CRITICAL FIX: Fetch plans from lead-service, not quotation-generation-service
// Plans are stored in lead-service after being fetched by RPA
async function fetchPlansFromPlanService(planIds: string[], leadId: string): Promise<any[]> {
  const LEAD_SERVICE_URL = process.env.LEAD_SERVICE_URL || 'http://localhost:7078';
  const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY;
  
  // Azure Functions use /api prefix by default
  const baseUrl = LEAD_SERVICE_URL.includes('/api') ? LEAD_SERVICE_URL : `${LEAD_SERVICE_URL}/api`;
  
  try {
    // Build headers for service-to-service authentication
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (INTERNAL_SERVICE_KEY) {
      headers['x-service-key'] = INTERNAL_SERVICE_KEY;
    }
    
    console.log(`Fetching plans for lead ${leadId} from ${baseUrl}/leads/${leadId}/plans`);
    
    // Fetch all plans for the lead from lead-service
    const response = await fetch(`${baseUrl}/leads/${leadId}/plans`, { headers });
    
    console.log(`Lead service response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Failed to fetch plans from lead-service: ${response.status} - ${errorText}`);
      return [];
    }
    
    const result = await response.json() as { success?: boolean; data?: any[] };
    
    console.log(`Lead service returned success=${result.success}, data count=${result.data?.length || 0}`);
    
    if (!result.success || !result.data) {
      console.warn('No plans data returned from lead-service');
      return [];
    }
    
    // Filter to only the requested plan IDs
    const allPlans = result.data;
    const requestedPlans = allPlans.filter((plan: any) => planIds.includes(plan.id));
    
    console.log(`[fetchPlansFromPlanService] Total plans from lead-service: ${allPlans.length}`);
    console.log(`[fetchPlansFromPlanService] Requested plan IDs: ${JSON.stringify(planIds)}`);
    console.log(`[fetchPlansFromPlanService] All plan IDs from service: ${JSON.stringify(allPlans.map((p: any) => p.id))}`);
    console.log(`[fetchPlansFromPlanService] Found ${requestedPlans.length} of ${planIds.length} requested plans`);
    console.log(`[fetchPlansFromPlanService] Matched plan IDs: ${JSON.stringify(requestedPlans.map((p: any) => p.id))}`);
    
    return requestedPlans;
  } catch (error) {
    console.error(`Error fetching plans from lead-service:`, error);
    return [];
  }
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


