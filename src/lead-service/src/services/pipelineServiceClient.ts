/**
 * Pipeline Service Client
 * Client for checking if a lead is managed by a pipeline
 */

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

/**
 * Check if a lead is managed by a pipeline
 * Simple boolean check for use in event handlers
 */
export async function isLeadManagedByPipeline(leadId: string): Promise<boolean> {
  const result = await checkLeadPipeline(leadId);
  return result.hasActivePipeline;
}

