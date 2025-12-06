/**
 * Event Grid Service for Pipeline Service
 * Publishes events related to pipeline state changes
 */

import { EventGridPublisherClient, AzureKeyCredential } from '@azure/eventgrid';
import { v4 as uuidv4 } from 'uuid';
import { getConfig } from '../lib/config';

let client: EventGridPublisherClient<'EventGrid'> | null = null;

/**
 * Get or create the Event Grid publisher client
 */
function getClient(): EventGridPublisherClient<'EventGrid'> {
  if (client) {
    return client;
  }

  const config = getConfig();
  const { topicEndpoint, topicKey } = config.eventGrid;

  if (!topicEndpoint || !topicKey) {
    console.warn('Event Grid not configured - events will not be published');
    // Return a mock client that does nothing
    return {
      send: async () => {
        console.log('Event Grid not configured - skipping event publish');
      },
    } as unknown as EventGridPublisherClient<'EventGrid'>;
  }

  client = new EventGridPublisherClient(
    topicEndpoint,
    'EventGrid',
    new AzureKeyCredential(topicKey),
    {
      allowInsecureConnection: true, // Allow HTTP for local development
    }
  );

  return client;
}

/**
 * Publish an event to Event Grid
 */
async function publishEvent(
  eventType: string,
  subject: string,
  data: Record<string, unknown>,
  dataVersion: string = '1.0'
): Promise<void> {
  try {
    const eventClient = getClient();
    const event = {
      id: uuidv4(),
      eventType,
      subject,
      eventTime: new Date().toISOString(),
      data,
      dataVersion,
    };

    await eventClient.send([event] as any);
    console.log(`Event published: ${eventType}`);
  } catch (error) {
    console.error(`Failed to publish event ${eventType}:`, error);
    // Don't throw - we don't want to fail operations due to event publishing issues
  }
}

// =============================================================================
// Pipeline Instance Events
// =============================================================================

export async function publishPipelineInstanceCreated(data: {
  instanceId: string;
  pipelineId: string;
  leadId: string;
  lineOfBusiness: string;
}): Promise<void> {
  await publishEvent(
    'pipeline.instance.created',
    `pipeline-instance/${data.instanceId}`,
    {
      ...data,
      createdAt: new Date().toISOString(),
    }
  );
}

export async function publishPipelineInstanceStepChanged(data: {
  instanceId: string;
  leadId: string;
  previousStepId: string | null;
  currentStepId: string;
  currentStepType: string;
  currentStageName?: string;
}): Promise<void> {
  await publishEvent(
    'pipeline.instance.step_changed',
    `pipeline-instance/${data.instanceId}`,
    {
      ...data,
      changedAt: new Date().toISOString(),
    }
  );
}

export async function publishPipelineInstanceCompleted(data: {
  instanceId: string;
  pipelineId: string;
  leadId: string;
  finalStatus: string;
}): Promise<void> {
  await publishEvent(
    'pipeline.instance.completed',
    `pipeline-instance/${data.instanceId}`,
    {
      ...data,
      completedAt: new Date().toISOString(),
    }
  );
}

// =============================================================================
// Approval Events
// =============================================================================

export async function publishApprovalRequired(data: {
  approvalId: string;
  instanceId: string;
  leadId: string;
  approverRole: string;
  stepName: string;
}): Promise<void> {
  await publishEvent(
    'pipeline.approval.required',
    `pipeline-approval/${data.approvalId}`,
    {
      ...data,
      requestedAt: new Date().toISOString(),
    }
  );
}

export async function publishApprovalDecided(data: {
  approvalId: string;
  instanceId: string;
  leadId: string;
  decision: 'approved' | 'rejected';
  decidedBy: string;
}): Promise<void> {
  await publishEvent(
    'pipeline.approval.decided',
    `pipeline-approval/${data.approvalId}`,
    {
      ...data,
      decidedAt: new Date().toISOString(),
    }
  );
}

// =============================================================================
// Notification Events
// =============================================================================

export async function publishPipelineNotificationRequired(data: {
  instanceId: string;
  leadId: string;
  lineOfBusiness: string;
  notificationType: string;
  channel: 'email' | 'sms' | 'push';
  recipientType: 'customer' | 'agent' | 'manager';
  templateId: string;
  customMessage?: string;
  leadReferenceId?: string;
  customerName?: string;
  stageName?: string;
}): Promise<void> {
  await publishEvent(
    'pipeline.notification.required',
    `pipeline-instance/${data.instanceId}`,
    {
      ...data,
      requestedAt: new Date().toISOString(),
    }
  );
}

// =============================================================================
// Pipeline Definition Events
// =============================================================================

export async function publishPipelineActivated(data: {
  pipelineId: string;
  lineOfBusiness: string;
  activatedBy: string;
}): Promise<void> {
  await publishEvent(
    'pipeline.definition.activated',
    `pipeline/${data.pipelineId}`,
    {
      ...data,
      activatedAt: new Date().toISOString(),
    }
  );
}

export async function publishPipelineDeactivated(data: {
  pipelineId: string;
  lineOfBusiness: string;
  deactivatedBy: string;
}): Promise<void> {
  await publishEvent(
    'pipeline.definition.deactivated',
    `pipeline/${data.pipelineId}`,
    {
      ...data,
      deactivatedAt: new Date().toISOString(),
    }
  );
}

