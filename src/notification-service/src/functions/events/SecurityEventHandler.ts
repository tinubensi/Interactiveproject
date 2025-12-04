/**
 * SecurityEventHandler - Event Grid trigger for security events
 */

import { app, EventGridEvent, InvocationContext } from '@azure/functions';
import { sendNotification } from '../../lib/notificationService';

/**
 * Event-to-template mapping
 */
const SECURITY_EVENT_MAP: Record<string, { template: string; channels: ('inApp' | 'email' | 'sms' | 'push')[] }> = {
  'security.alert.triggered': { template: 'login_alert', channels: ['inApp', 'email', 'sms'] },
  'auth.login.failed.threshold': { template: 'login_alert', channels: ['email', 'sms'] },
  'auth.password.changed': { template: 'password_changed', channels: ['inApp', 'email'] },
  'authorization.role.assigned': { template: 'role_granted', channels: ['inApp', 'email'] },
  'staff.license_expiring': { template: 'license_expiring', channels: ['inApp', 'email'] },
};

interface SecurityEventData {
  userId: string;
  userEmail: string;
  eventType: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  timestamp?: string;
  // For role events
  roleName?: string;
  assignedBy?: string;
  // For license events
  staffId?: string;
  staffName?: string;
  licenseType?: string;
  expiryDate?: string;
  daysUntilExpiry?: number;
}

export async function SecurityEventHandler(
  event: EventGridEvent,
  context: InvocationContext
): Promise<void> {
  context.log(`SecurityEventHandler processing event: ${event.eventType}`);

  try {
    const eventType = event.eventType as string;
    const mapping = SECURITY_EVENT_MAP[eventType];

    if (!mapping) {
      context.log(`No mapping for event type: ${eventType}`);
      return;
    }

    const data = event.data as unknown as SecurityEventData;

    if (!data.userId) {
      context.log('No userId in event data');
      return;
    }

    // Build variables based on event type
    const variables: Record<string, unknown> = {
      userId: data.userId,
      userEmail: data.userEmail,
      timestamp: data.timestamp || new Date().toISOString(),
    };

    // Add security-specific variables
    if (eventType.startsWith('security.alert') || eventType.startsWith('auth.login.failed')) {
      variables.ipAddress = data.ipAddress || 'Unknown';
      variables.location = data.location || 'Unknown location';
      variables.userAgent = data.userAgent || 'Unknown device';
    }

    // Add role-specific variables
    if (eventType.includes('role.assigned')) {
      variables.roleName = data.roleName;
      variables.assignedBy = data.assignedBy;
    }

    // Add license-specific variables
    if (eventType.includes('license_expiring')) {
      variables.staffId = data.staffId;
      variables.staffName = data.staffName;
      variables.licenseType = data.licenseType;
      variables.expiryDate = data.expiryDate;
      variables.daysUntilExpiry = data.daysUntilExpiry;
    }

    // Send notification
    const result = await sendNotification({
      templateId: mapping.template,
      recipients: [data.userId],
      variables,
      channels: mapping.channels,
      priority: 'high',
      source: {
        service: 'security-service',
        eventType,
      },
      metadata: {
        userEmail: data.userEmail,
      },
    });

    context.log(`Security notification sent: ${result.summary.sent}/${result.summary.total}`);
  } catch (error) {
    context.error('SecurityEventHandler error:', error);
    throw error;
  }
}

app.eventGrid('SecurityEventHandler', {
  handler: SecurityEventHandler,
});

