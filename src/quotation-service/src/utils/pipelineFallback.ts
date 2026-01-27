/**
 * HTTP Fallback utility for pipeline events
 * Calls pipeline service directly if Event Grid fails
 */

import { v4 as uuidv4 } from 'uuid';

export async function notifyPipelineService(
  eventType: string,
  eventData: {
    leadId: string;
    lineOfBusiness?: string;
    [key: string]: unknown;
  },
  context?: { log?: (...args: unknown[]) => void }
): Promise<void> {
  const log = context?.log || console.log;
  const pipelineServiceUrl = process.env.PIPELINE_SERVICE_URL ||
    'https://func-nectaria-pipeline-dev.azurewebsites.net';

  try {
    // Generate request ID for deduplication
    const requestId = uuidv4();
    
    // Extract top-level properties and create data object with remaining fields
    const { leadId, lineOfBusiness, ...additionalData } = eventData;

    log(`[HTTP Fallback] Notifying pipeline service: ${eventType} for lead ${leadId} (requestId: ${requestId})`);

    const response = await fetch(`${pipelineServiceUrl}/api/pipeline/process-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.INTERNAL_SERVICE_KEY && {
          'x-service-key': process.env.INTERNAL_SERVICE_KEY,
        }),
      },
      body: JSON.stringify({
        eventType,
        leadId,
        lineOfBusiness,
        requestId, // Include request ID for deduplication
        data: additionalData,
      }),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (response.ok) {
      log(`[HTTP Fallback] Successfully notified pipeline service: ${eventType} (requestId: ${requestId})`);
    } else {
      const errorText = await response.text();
      log(`[HTTP Fallback] Pipeline service returned ${response.status}: ${errorText} (requestId: ${requestId})`);
    }
  } catch (error: any) {
    log(`[HTTP Fallback] Failed to notify pipeline service: ${error?.message || String(error)}`);
    // Don't throw - this is a fallback, Event Grid should handle it
  }
}
