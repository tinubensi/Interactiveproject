/**
 * Notification Client - Sends notifications via Notification Service
 */

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:7075';
const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || '';

/**
 * Template IDs for workflow notifications
 */
export const WORKFLOW_NOTIFICATION_TEMPLATES = {
  APPROVAL_REQUIRED: 'approval_required',
  APPROVAL_REMINDER: 'approval_reminder',
  APPROVAL_ESCALATED: 'approval_escalated',
  APPROVAL_DECIDED: 'approval_decided',
} as const;

/**
 * Send a notification via the Notification Service
 */
export async function sendNotification(
  templateId: string,
  recipients: string[],
  variables: Record<string, unknown>,
  source: { entityType: string; entityId: string },
  channels?: ('inApp' | 'email' | 'sms' | 'push')[],
  priority?: 'low' | 'normal' | 'high' | 'urgent'
): Promise<void> {
  // Skip if no notification service configured
  if (!INTERNAL_SERVICE_KEY) {
    console.log(`[Notification] ${templateId} to ${recipients.join(', ')}`);
    console.log(`[Notification] Variables:`, variables);
    return;
  }

  try {
    const payload = {
      templateId,
      recipients,
      variables,
      channels,
      priority,
      source: {
        service: 'workflow-service',
        entityType: source.entityType,
        entityId: source.entityId,
      },
    };

    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/api/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': INTERNAL_SERVICE_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[Notification] Failed to send: ${response.status} ${response.statusText}`);
    } else {
      const result = await response.json();
      console.log(`[Notification] Sent: ${result.summary?.sent || 0}/${result.summary?.total || 0}`);
    }
  } catch (error) {
    // Log locally but don't fail the operation
    console.error('[Notification] Error sending notification:', error);
  }
}

/**
 * Send approval required notification
 */
export async function sendApprovalRequiredNotification(
  approvalId: string,
  assignedTo: string[],
  variables: {
    approvalType: string;
    requesterName: string;
    entityType: string;
    amount?: number;
  }
): Promise<void> {
  await sendNotification(
    WORKFLOW_NOTIFICATION_TEMPLATES.APPROVAL_REQUIRED,
    assignedTo,
    {
      ...variables,
      approvalId,
    },
    { entityType: 'approval', entityId: approvalId },
    ['inApp', 'email', 'push'],
    'high'
  );
}

/**
 * Send approval escalated notification
 */
export async function sendApprovalEscalatedNotification(
  approvalId: string,
  escalatedTo: string[],
  variables: {
    approvalType: string;
    requesterName: string;
    originalAssignee?: string;
    waitingDays?: number;
  }
): Promise<void> {
  await sendNotification(
    WORKFLOW_NOTIFICATION_TEMPLATES.APPROVAL_ESCALATED,
    escalatedTo,
    {
      ...variables,
      approvalId,
    },
    { entityType: 'approval', entityId: approvalId },
    ['inApp', 'email', 'sms'],
    'urgent'
  );
}

/**
 * Send approval decided notification
 */
export async function sendApprovalDecidedNotification(
  approvalId: string,
  requesterId: string,
  variables: {
    approvalType: string;
    entityType: string;
    decision: 'Approved' | 'Rejected';
    decidedBy: string;
    comments?: string;
  }
): Promise<void> {
  await sendNotification(
    WORKFLOW_NOTIFICATION_TEMPLATES.APPROVAL_DECIDED,
    [requesterId],
    {
      ...variables,
      approvalId,
    },
    { entityType: 'approval', entityId: approvalId },
    ['inApp'],
    'normal'
  );
}

/**
 * Send approval reminder notification
 */
export async function sendApprovalReminderNotification(
  approvalId: string,
  assignedTo: string[],
  variables: {
    approvalType: string;
    requesterName: string;
    waitingDays: number;
  }
): Promise<void> {
  await sendNotification(
    WORKFLOW_NOTIFICATION_TEMPLATES.APPROVAL_REMINDER,
    assignedTo,
    {
      ...variables,
      approvalId,
    },
    { entityType: 'approval', entityId: approvalId },
    ['inApp', 'email'],
    'normal'
  );
}

