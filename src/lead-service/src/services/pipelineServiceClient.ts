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
 */
export async function notifyLeadCreated(
  lead: any,
  options: { log?: (msg: string) => void } = {}
): Promise<{ success: boolean; error?: any; status?: number; responseText?: string; payload?: any }> {
  const log = options.log || console.log;

  if (!PIPELINE_SERVICE_URL) {
    const msg = 'Pipeline service URL not configured';
    log(`[HTTP Fallback] ${msg}`);
    return { success: false, error: msg };
  }

  // Generate request ID for deduplication
  const requestId = uuidv4();

  const payload = {
    eventType: 'lead.created',
    leadId: lead.id,
    lineOfBusiness: lead.lineOfBusiness,
    businessType: lead.businessType,
    requestId, // Include request ID for deduplication
    data: {
      ...lead,
      // Ensure IDs match what orchestrator expects
      leadId: lead.id
    }
  };

  log(`[HTTP Fallback] Notifying pipeline service: lead.created for lead ${lead.id} (requestId: ${requestId})`);

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

    if (!response.ok) {
      const text = await response.text();
      log(`[HTTP Fallback] Pipeline service returned error: ${response.status} ${text} (requestId: ${requestId})`);
      return { success: false, status: response.status, responseText: text, error: `Status ${response.status}` };
    } else {
      const text = await response.text();
      log(`[HTTP Fallback] Success: ${text} (requestId: ${requestId})`);
      return { success: true, responseText: text, payload, status: response.status };
    }
  } catch (error: any) {
    log(`[HTTP Fallback] Failed to notify pipeline service: ${error.message} (requestId: ${requestId})`);
    return { success: false, error: error.message };
  }
}
