/**
 * Pipeline Service Client
 * Client for checking if a lead is managed by a pipeline
 */

import { v4 as uuidv4 } from 'uuid';

const PIPELINE_SERVICE_URL = process.env.PIPELINE_SERVICE_URL || 'http://localhost:7090';
const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || '';

export interface PipelineCheckResult {
  leadId: string;
  hasActivePipeline: boolean;
  instance?: {
    instanceId: string;
    pipelineId: string;
    pipelineName: string;
    status: string;
    currentStepId: string;
    currentStepType: string;
    currentStageName?: string;
    progressPercent: number;
  };
}

/**
 * Check if a lead has an active pipeline instance
 * Used by event handlers to skip hardcoded stage changes when pipeline is active
 */
export async function checkLeadPipeline(leadId: string): Promise<PipelineCheckResult> {
  try {
    const response = await fetch(
      `${PIPELINE_SERVICE_URL}/api/pipeline/check/${leadId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-service-key': INTERNAL_SERVICE_KEY,
        },
      }
    );

    if (!response.ok) {
      // If pipeline service is unavailable, assume no pipeline
      console.warn(`Pipeline service returned ${response.status} - assuming no active pipeline`);
      return { leadId, hasActivePipeline: false };
    }

    const result = await response.json() as { data?: PipelineCheckResult };
    return result.data || { leadId, hasActivePipeline: false };
  } catch (error) {
    // If pipeline service is unavailable, fallback to no pipeline
    console.warn('Pipeline service unavailable:', error);
    return { leadId, hasActivePipeline: false };
  }
}

export async function isLeadManagedByPipeline(leadId: string): Promise<boolean> {
  const result = await checkLeadPipeline(leadId);
  return result.hasActivePipeline;
}

/**
 * Notify Pipeline Service about lead creation (HTTP Fallback)
 * UPDATED: Also triggers Quotation Service directly as emergency fallback
 */
export async function notifyLeadCreated(
  lead: any,
  options: { log?: (msg: string) => void } = {}
): Promise<{ success: boolean; error?: any; status?: number; responseText?: string; payload?: any }> {
  const log = options.log || console.log;

  // Try Pipeline Service first
  if (PIPELINE_SERVICE_URL) {
    const requestId = uuidv4();
    const payload = {
      eventType: 'lead.created',
      leadId: lead.id,
      lineOfBusiness: lead.lineOfBusiness,
      businessType: lead.businessType,
      requestId,
      data: {
        ...lead,
        leadId: lead.id
      }
    };

    log(`[HTTP Fallback] Notifying pipeline service: lead.created for lead ${lead.id}`);

    try {
      const response = await fetch(
        `${PIPELINE_SERVICE_URL}/api/pipeline/process-event`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-service-key': INTERNAL_SERVICE_KEY,
          },
          body: JSON.stringify(payload)
        }
      );

      if (response.ok) {
        const text = await response.text();
        log(`[HTTP Fallback] Pipeline service success: ${text}`);
        return { success: true, responseText: text, payload, status: response.status };
      } else {
        const text = await response.text();
        log(`[HTTP Fallback] Pipeline service error: ${response.status} ${text}`);
        // Don't return yet - try Quotation Service fallback
      }
    } catch (error: any) {
      log(`[HTTP Fallback] Pipeline service failed: ${error.message}`);
      // Don't return yet - try Quotation Service fallback
    }
  }

  // EMERGENCY FALLBACK: Trigger Quotation Generation Service
  log(`[EMERGENCY FALLBACK] Triggering Quotation Generation Service for lead ${lead.id}`);
  
  const QUOTATION_GEN_URL = process.env.QUOTATION_GEN_SERVICE_URL || 
    'https://quotation-gen-service-74e1210c.azurewebsites.net/api';
  
  try {
    const response = await fetch(
      `${QUOTATION_GEN_URL}/plans/fetch`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-key': INTERNAL_SERVICE_KEY,
        },
        body: JSON.stringify({
          leadId: lead.id,
          lineOfBusiness: lead.lineOfBusiness,
          businessType: lead.businessType || 'individual',
          leadData: lead.lobData || {}
        })
      }
    );

    if (response.ok) {
      const result = await response.json();
      const message = (result as any).message || 'Success';
      log(`[EMERGENCY FALLBACK] ✅ Quotation Service triggered: ${message}`);
      log(`[EMERGENCY FALLBACK] Response status: ${response.status}`);
      log(`[EMERGENCY FALLBACK] RPA jobs triggered: ${(result as any).data?.rpaJobsTriggered || 'unknown'}`);
      return { 
        success: true, 
        responseText: JSON.stringify(result), 
        status: response.status 
      };
    } else {
      const text = await response.text();
      log(`[EMERGENCY FALLBACK] ❌ Quotation Service error: ${response.status} ${text}`);
      log(`[EMERGENCY FALLBACK] URL attempted: ${QUOTATION_GEN_URL}/plans/fetch`);
      return { 
        success: false, 
        status: response.status, 
        responseText: text, 
        error: `Quotation Service returned ${response.status}` 
      };
    }
  } catch (error: any) {
    log(`[EMERGENCY FALLBACK] ❌ Failed to trigger Quotation Service: ${error.message}`);
    log(`[EMERGENCY FALLBACK] URL attempted: ${QUOTATION_GEN_URL}/plans/fetch`);
    log(`[EMERGENCY FALLBACK] Error details: ${error.stack || error}`);
    return { success: false, error: error.message };
  }
}
