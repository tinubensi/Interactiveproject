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
 * Get lead data by ID
 */
export async function getLead(
  leadId: string,
  lineOfBusiness: string
): Promise<LeadData | null> {
  try {
    const baseUrl = getLeadServiceUrl();
    const response = await fetch(
      `${baseUrl}/api/leads/${leadId}?lineOfBusiness=${lineOfBusiness}`,
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
 */
export async function updateLeadStage(
  leadId: string,
  lineOfBusiness: string,
  stageRequest: StageChangeRequest
): Promise<boolean> {
  try {
    const baseUrl = getLeadServiceUrl();
    const response = await fetch(
      `${baseUrl}/api/leads/${leadId}/stage?lineOfBusiness=${lineOfBusiness}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-service-key': getConfig().internalServiceKey,
        },
        body: JSON.stringify(stageRequest),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to update lead stage: ${error}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating lead stage:', error);
    return false;
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
 * Evaluate a lead-based condition
 */
export async function evaluateLeadCondition(
  leadId: string,
  lineOfBusiness: string,
  conditionType: string,
  conditionValue?: string | number
): Promise<boolean> {
  const lead = await getLead(leadId, lineOfBusiness);
  if (!lead) {
    console.warn(`Lead not found for condition evaluation: ${leadId}`);
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
          console.warn(`Document service returned ${docResponse.status} for lead ${leadId}`);
          return false; // Safe default - assume documents missing
        }
        
        const docResult = await docResponse.json() as { allRequiredUploaded?: boolean };
        return docResult.allRequiredUploaded === true;
      } catch (error) {
        console.warn('Error checking required documents:', error);
        return false; // Safe default - assume documents missing
      }

    default:
      console.warn(`Unknown condition type: ${conditionType}`);
      return false;
  }
}

