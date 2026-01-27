/**
 * Pipeline Service HTTP Fallback
 * Used when Event Grid is not available
 */

import axios from 'axios';

interface NotifyPipelineServiceParams {
  log?: (message: string) => void;
}

export async function notifyPipelineService(
  eventType: string,
  data: Record<string, any>,
  options: NotifyPipelineServiceParams = {}
): Promise<void> {
  const pipelineServiceUrl = process.env.PIPELINE_SERVICE_URL || 'http://localhost:7078';
  const baseUrl = pipelineServiceUrl.includes('/api') ? pipelineServiceUrl : `${pipelineServiceUrl}/api`;
  const endpoint = `${baseUrl}/pipeline/events`;

  try {
    await axios.post(
      endpoint,
      {
        eventType,
        data,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-service-key': process.env.INTERNAL_SERVICE_KEY || '',
        },
        timeout: 10000, // 10 seconds
      }
    );

    if (options.log) {
      options.log(`[HTTP Fallback] Successfully notified pipeline service: ${eventType}`);
    }
  } catch (error: any) {
    if (options.log) {
      options.log(`[HTTP Fallback] Failed to notify pipeline service: ${error.message}`);
    }
    // Don't throw - this is a fallback mechanism
  }
}
