/**
 * Event Grid Publisher for Authorization Service
 */

import { EventGridPublisherClient, AzureKeyCredential, SendEventGridEventInput } from '@azure/eventgrid';
import { getConfig } from './config';

let publisherClient: EventGridPublisherClient<'EventGrid'> | null = null;

/**
 * Event types published by the Authorization Service
 */
export const AUTH_EVENTS = {
  ROLE_CREATED: 'role.created',
  ROLE_UPDATED: 'role.updated',
  ROLE_DELETED: 'role.deleted',
  ROLE_ASSIGNED: 'role.assigned',
  ROLE_REMOVED: 'role.removed',
  ROLE_APPROVAL_REQUIRED: 'role.approval.required',
  PERMISSION_DENIED: 'permission.denied',
  PERMISSION_TEMP_GRANTED: 'permission.temp.granted',
  PERMISSION_TEMP_EXPIRED: 'permission.temp.expired',
  PERMISSION_TEMP_REVOKED: 'permission.temp.revoked',
} as const;

export type AuthEventType = typeof AUTH_EVENTS[keyof typeof AUTH_EVENTS];

/**
 * Base event payload structure
 */
export interface AuthEventPayload {
  timestamp: string;
  [key: string]: unknown;
}

/**
 * Role event payload
 */
export interface RoleEventPayload extends AuthEventPayload {
  roleId: string;
  displayName: string;
  permissions?: string[];
  performedBy: string;
}

/**
 * Role assignment event payload
 */
export interface RoleAssignmentEventPayload extends AuthEventPayload {
  userId: string;
  email?: string;
  roleId: string;
  assignedBy?: string;
  removedBy?: string;
  reason?: string;
  effectivePermissions?: string[];
}

/**
 * Permission denied event payload
 */
export interface PermissionDeniedEventPayload extends AuthEventPayload {
  userId: string;
  email?: string;
  permission: string;
  resource?: {
    type: string;
    id: string | null;
  };
  userRoles: string[];
  userPermissions: string[];
}

/**
 * Temporary permission event payload
 */
export interface TempPermissionEventPayload extends AuthEventPayload {
  userId: string;
  permission: string;
  grantedBy?: string;
  revokedBy?: string;
  validFrom?: string;
  validUntil: string;
  reason: string;
}

/**
 * Initialize the Event Grid publisher client
 */
export function getPublisherClient(): EventGridPublisherClient<'EventGrid'> | null {
  const config = getConfig();
  
  if (!config.eventGrid.topicEndpoint || !config.eventGrid.topicKey) {
    console.warn('Event Grid not configured - events will not be published');
    return null;
  }

  if (publisherClient) {
    return publisherClient;
  }

  publisherClient = new EventGridPublisherClient<'EventGrid'>(
    config.eventGrid.topicEndpoint,
    'EventGrid',
    new AzureKeyCredential(config.eventGrid.topicKey)
  );

  return publisherClient;
}

/**
 * Publish an event to Event Grid
 */
export async function publishEvent<T extends AuthEventPayload>(
  eventType: AuthEventType,
  subject: string,
  data: T
): Promise<void> {
  const client = getPublisherClient();
  
  if (!client) {
    console.log(`[Event] ${eventType} - ${subject}:`, JSON.stringify(data));
    return;
  }

  try {
    await client.send([
      {
        eventType,
        subject,
        dataVersion: '1.0',
        data: {
          ...data,
          timestamp: data.timestamp || new Date().toISOString(),
        },
      },
    ]);
    console.log(`[Event Published] ${eventType} - ${subject}`);
  } catch (error) {
    console.error(`[Event Error] Failed to publish ${eventType}:`, error);
    // Don't throw - event publishing failures shouldn't break the main operation
  }
}

/**
 * Reset publisher client (for testing)
 */
export function resetPublisherClient(): void {
  publisherClient = null;
}

