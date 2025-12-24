/**
 * Lead Service Client
 * Client for communicating with the Lead Service to update lead stages
 */

import { getConfig } from '../lib/config';

// =============================================================================
// Types
// =============================================================================

export interface LeadData {
  id: string;
  referenceId: string;
  lineOfBusiness: string;
  businessType: string;
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
  isHotLead: boolean;
  currentStage: string;
  stageId: string;
  lobData?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface StageChangeRequest {
  stageId: string;
  stageName?: string;
  remark?: string;
  changedBy?: string;
}

export interface UpdateLeadStageResult {
  success: boolean;
  timeout?: boolean;
  error?: string;
  statusCode?: number;
}

// =============================================================================
// Client Functions
// =============================================================================

/**
 * Get the Lead Service base URL
 */
function getLeadServiceUrl(): string {
  const config = getConfig();
  return config.services.leadServiceUrl;
}

/**
 * Get the Document Service base URL
 */
function getDocumentServiceUrl(): string {
  const config = getConfig();
  return config.services.documentServiceUrl;
}

/**
 * Get the Quotation Service base URL
 */
function getQuotationServiceUrl(): string {
  const config = getConfig();
  return config.services.quotationServiceUrl;
}

/**
 * Get lead data by ID
 */
export async function getLead(
  leadId: string,
  lineOfBusiness: string
): Promise<LeadData | null> {
  try {
    const baseUrl = getLeadServiceUrl();
    const response = await fetch(
      `${baseUrl}/leads/${leadId}?lineOfBusiness=${lineOfBusiness}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-service-key': getConfig().internalServiceKey,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to get lead: ${response.statusText}`);
    }

    const result = await response.json() as { data?: { lead?: LeadData }; lead?: LeadData };
    return result.data?.lead || result.lead || (result as unknown as LeadData);
  } catch (error) {
    console.error('Error getting lead:', error);
    return null;
  }
}

/**
 * Update lead stage via Lead Service API
 * Returns detailed result including timeout information
 */
export async function updateLeadStage(
  leadId: string,
  lineOfBusiness: string,
  stageRequest: StageChangeRequest
): Promise<UpdateLeadStageResult> {
  const controller = new AbortController();
  const timeoutMs = 10000; // 10 seconds
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const baseUrl = getLeadServiceUrl();
    if (!baseUrl) {
      clearTimeout(timeoutId);
      return { success: false, error: 'LEAD_SERVICE_URL not configured' };
    }

    const response = await fetch(
      `${baseUrl}/leads/${leadId}/stage/internal?lineOfBusiness=${lineOfBusiness}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-service-key': getConfig().internalServiceKey,
        },
        body: JSON.stringify(stageRequest),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to update lead stage: HTTP ${response.status} - ${error}`);
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${error}`,
        statusCode: response.status
      };
    }

    return { success: true };
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    // Check if it's a timeout
    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      console.warn(`Request timeout for lead ${leadId} - request may have succeeded`);
      return { success: false, timeout: true, error: 'Request timeout' };
    }
    
    console.error('Error updating lead stage:', error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Get lead summary for approval context
 */
export async function getLeadSummary(
  leadId: string,
  lineOfBusiness: string
): Promise<Record<string, unknown> | null> {
  const lead = await getLead(leadId, lineOfBusiness);
  if (!lead) return null;

  return {
    referenceId: lead.referenceId,
    customerName: `${lead.firstName} ${lead.lastName}`,
    email: lead.email,
    lineOfBusiness: lead.lineOfBusiness,
    businessType: lead.businessType,
    isHotLead: lead.isHotLead,
    currentStage: lead.currentStage,
  };
}

/**
 * Quotation data interface
 */
interface Quotation {
  id: string;
  leadId: string;
  status: string;
  createdAt: string;
  version?: number;
  [key: string]: unknown;
}

/**
 * Get quotations for a lead from Quotation Service
 */
async function getQuotationByLeadId(
  leadId: string,
  lineOfBusiness: string
): Promise<Quotation[]> {
  try {
    const baseUrl = getQuotationServiceUrl();
    if (!baseUrl) {
      console.warn('Quotation service URL not configured');
      return [];
    }

    const response = await fetch(
      `${baseUrl}/quotations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-key': getConfig().internalServiceKey,
        },
        body: JSON.stringify({
          leadId,
          page: 1,
          limit: 100,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          filters: {
            lineOfBusiness: [lineOfBusiness],
          },
        }),
      }
    );

    if (!response.ok) {
      console.warn(`Quotation service returned ${response.status} for lead ${leadId}`);
      return [];
    }

    const result = await response.json() as { 
      success?: boolean; 
      data?: Quotation[];
      quotations?: Quotation[];
    };
    
    // Handle different response formats
    return result.data || result.quotations || [];
  } catch (error) {
    console.warn('Error getting quotations:', error);
    return [];
  }
}

/**
 * Evaluate a lead-based condition
 */
export async function evaluateLeadCondition(
  leadId: string,
  lineOfBusiness: string,
  conditionType: string,
  conditionValue?: string | number,
  eventData?: Record<string, unknown>,
  log: (...args: unknown[]) => void = console.log
): Promise<boolean> {
  const lead = await getLead(leadId, lineOfBusiness);
  if (!lead) {
    log(`[WARN] Lead not found for condition evaluation: ${leadId}`);
    return false;
  }

  switch (conditionType) {
    case 'is_hot_lead':
      return lead.isHotLead === true;

    case 'lob_is_medical':
      return lead.lineOfBusiness === 'medical';

    case 'lob_is_motor':
      return lead.lineOfBusiness === 'motor';

    case 'lob_is_general':
      return lead.lineOfBusiness === 'general';

    case 'lob_is_marine':
      return lead.lineOfBusiness === 'marine';

    case 'business_type_is_individual':
      return lead.businessType === 'individual';

    case 'business_type_is_group':
      return lead.businessType === 'group';

    case 'lead_value_above_threshold':
      // This would need to be implemented based on how lead value is calculated
      // For now, we'll check lobData for premium or value fields
      const leadValue = (lead.lobData?.estimatedPremium as number) || 0;
      const threshold = Number(conditionValue) || 0;
      return leadValue > threshold;

    case 'has_required_documents':
      // Check document service for required documents
      try {
        const docBaseUrl = getDocumentServiceUrl();
        const docResponse = await fetch(
          `${docBaseUrl}/api/documents/lead/${leadId}/check-required?lineOfBusiness=${lineOfBusiness}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'x-service-key': getConfig().internalServiceKey,
            },
          }
        );

        if (!docResponse.ok) {
          log(`[WARN] Document service returned ${docResponse.status} for lead ${leadId}`);
          return false; // Safe default - assume documents missing
        }

        const docResult = await docResponse.json() as { allRequiredUploaded?: boolean };
        return docResult.allRequiredUploaded === true;
      } catch (error) {
        log(`[WARN] Error checking required documents:`, error);
        return false; // Safe default - assume documents missing
      }

    case 'quotation_approved':
      // CRITICAL FIX: Check event data first to avoid race condition
      // If event data indicates plan was selected, return true immediately
      log(`[QUOTATION_APPROVED] Evaluating condition. eventData present: ${!!eventData}`);
      
      if (eventData) {
        const responseType = eventData.responseType as string;
        const selectedPlanId = eventData.selectedPlanId;
        
        log(`[QUOTATION_APPROVED] Event data: responseType="${responseType}", selectedPlanId="${selectedPlanId}"`);
        log(`[QUOTATION_APPROVED] Event data keys: ${Object.keys(eventData).join(', ')}`);
        log(`[QUOTATION_APPROVED] Event data full: ${JSON.stringify(eventData)}`);
        
        // Handle both event types that indicate customer selected a plan:
        // 1. customer.responded event: has responseType='plan_selected' AND selectedPlanId
        // 2. quotation.pending_approval event: has selectedPlanId (customer selected plan)
        // Check: selectedPlanId must be a non-empty string (not undefined, null, or empty)
        // Also handle cases where selectedPlanId might be a number (convert to string)
        const selectedPlanIdStr = selectedPlanId ? String(selectedPlanId).trim() : '';
        const hasValidSelectedPlan = selectedPlanIdStr.length > 0;
        const isPlanSelectedResponse = responseType === 'plan_selected' && hasValidSelectedPlan;
        
        log(`[QUOTATION_APPROVED] Condition check: responseType="${responseType}", selectedPlanId="${selectedPlanId}" (as string: "${selectedPlanIdStr}")`);
        log(`[QUOTATION_APPROVED] Condition check: hasValidSelectedPlan=${hasValidSelectedPlan}, isPlanSelectedResponse=${isPlanSelectedResponse}`);
        
        if (isPlanSelectedResponse || hasValidSelectedPlan) {
          log(`[QUOTATION_APPROVED] ✓ Event data confirms plan selection - returning true immediately`);
          return true; // Customer selected a plan - approved!
        } else {
          log(`[QUOTATION_APPROVED] ✗ Event data does NOT indicate plan selection - will check API`);
          log(`[QUOTATION_APPROVED] Response type: "${responseType}", selectedPlanId: "${selectedPlanId}"`);
        }
      } else {
        log(`[QUOTATION_APPROVED] ✗ No eventData provided - will check API`);
      }

      // Fallback: Check if customer has approved the quotation by selecting a plan
      // OR if quotation is already internally approved
      try {
        const quotations = await getQuotationByLeadId(leadId, lineOfBusiness);
        
        if (quotations.length === 0) {
          return false; // No quotations found
        }

        // Find the most recent quotation (already sorted by createdAt desc)
        // Or use version if available
        const mostRecentQuotation = quotations.sort((a, b) => {
          // First try to sort by version (higher version = more recent)
          if (a.version && b.version) {
            return b.version - a.version;
          }
          // Fallback to createdAt
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        })[0];

        const status = mostRecentQuotation.status;
        const hasCustomerSelectedPlan = !!mostRecentQuotation.customerSelectedPlanId;
        
        // Customer approval: customer selected a plan (pending_approval status)
        // OR quotation is already internally approved (approved/policy_issued)
        return hasCustomerSelectedPlan || status === 'approved' || status === 'policy_issued';
      } catch (error) {
        log(`[WARN] Error checking quotation approval status:`, error);
        return false; // Safe default - assume not approved
      }

    default:
      log(`[WARN] Unknown condition type: ${conditionType}`);
      return false;
  }
}

