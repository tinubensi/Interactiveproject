/**
 * WorkflowEventHandler - Event Grid trigger for workflow events
 */

import { app, EventGridEvent, InvocationContext } from '@azure/functions';
import { sendNotification, resolveRecipients } from '../../lib/notificationService';

/**
 * Event-to-template mapping
 */
const WORKFLOW_EVENT_MAP: Record<string, { template: string; channels: ('inApp' | 'email' | 'sms' | 'push')[] }> = {
  'workflow.approval.required': { template: 'approval_required', channels: ['inApp', 'email', 'push'] },
  'workflow.approval.escalated': { template: 'approval_escalated', channels: ['inApp', 'email', 'sms'] },
  'workflow.approval.decided': { template: 'approval_decided', channels: ['inApp'] },
  'workflow.approval.reminder': { template: 'approval_reminder', channels: ['inApp', 'email'] },
};

interface ApprovalEventData {
  approvalId: string;
  approvalType: string;
  entityType: string;
  entityId: string;
  assignedTo: string | string[];
  requesterName: string;
  requesterId: string;
  amount?: number;
  decision?: string;
  decidedBy?: string;
}

export async function WorkflowEventHandler(
  event: EventGridEvent,
  context: InvocationContext
): Promise<void> {
  context.log(`WorkflowEventHandler processing event: ${event.eventType}`);

  try {
    const eventType = event.eventType as string;
    const mapping = WORKFLOW_EVENT_MAP[eventType];

    if (!mapping) {
      context.log(`No mapping for event type: ${eventType}`);
      return;
    }

    const data = event.data as unknown as ApprovalEventData;

    // Resolve recipients
    const recipients = await resolveRecipients(data.assignedTo);

    if (recipients.length === 0) {
      context.log('No recipients found for event');
      return;
    }

    // Build variables
    const variables: Record<string, unknown> = {
      approvalId: data.approvalId,
      approvalType: data.approvalType,
      entityType: data.entityType,
      entityId: data.entityId,
      requesterName: data.requesterName,
      requesterId: data.requesterId,
    };

    if (data.amount !== undefined) {
      variables.amount = data.amount;
    }

    if (data.decision) {
      variables.decision = data.decision;
    }

    if (data.decidedBy) {
      variables.decidedBy = data.decidedBy;
    }

    // Send notification
    const result = await sendNotification({
      templateId: mapping.template,
      recipients,
      variables,
      channels: mapping.channels,
      source: {
        service: 'workflow-service',
        entityType: 'approval',
        entityId: data.approvalId,
        eventType,
      },
    });

    context.log(`Notification sent: ${result.summary.sent}/${result.summary.total}`);
  } catch (error) {
    context.error('WorkflowEventHandler error:', error);
    throw error;
  }
}

app.eventGrid('WorkflowEventHandler', {
  handler: WorkflowEventHandler,
});

