/**
 * Event Grid Publisher for Staff Management Service
 */

import { EventGridPublisherClient, AzureKeyCredential } from '@azure/eventgrid';
import { getConfig } from './config';

let publisherClient: EventGridPublisherClient<'EventGrid'> | null = null;

/**
 * Event types published by the Staff Management Service
 */
export const STAFF_EVENTS = {
  STAFF_CREATED: 'staff.created',
  STAFF_UPDATED: 'staff.updated',
  STAFF_ACTIVATED: 'staff.activated',
  STAFF_DEACTIVATED: 'staff.deactivated',
  STAFF_TERRITORY_ASSIGNED: 'staff.territory_assigned',
  STAFF_TEAM_JOINED: 'staff.team_joined',
  STAFF_TEAM_LEFT: 'staff.team_left',
  STAFF_LICENSE_EXPIRING: 'staff.license_expiring',
  TEAM_CREATED: 'team.created',
  TEAM_UPDATED: 'team.updated',
  TEAM_DELETED: 'team.deleted',
} as const;

export type StaffEventType = typeof STAFF_EVENTS[keyof typeof STAFF_EVENTS];

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
 * Publish a staff event
 */
export async function publishStaffEvent(
  eventType: StaffEventType,
  staffId: string,
  data: Record<string, unknown>
): Promise<void> {
  const client = getPublisherClient();

  if (!client) {
    console.log(`[Staff Event] ${eventType}:`, { staffId, ...data });
    return;
  }

  try {
    await client.send([
      {
        eventType,
        subject: `/staff/${staffId}`,
        dataVersion: '1.0',
        data: {
          staffId,
          ...data,
          timestamp: new Date().toISOString(),
        },
      },
    ]);
    console.log(`[Staff Event Published] ${eventType} for ${staffId}`);
  } catch (error) {
    console.error(`[Staff Event Error] Failed to publish ${eventType}:`, error);
  }
}

/**
 * Publish a team event
 */
export async function publishTeamEvent(
  eventType: StaffEventType,
  teamId: string,
  data: Record<string, unknown>
): Promise<void> {
  const client = getPublisherClient();

  if (!client) {
    console.log(`[Team Event] ${eventType}:`, { teamId, ...data });
    return;
  }

  try {
    await client.send([
      {
        eventType,
        subject: `/teams/${teamId}`,
        dataVersion: '1.0',
        data: {
          teamId,
          ...data,
          timestamp: new Date().toISOString(),
        },
      },
    ]);
    console.log(`[Team Event Published] ${eventType} for ${teamId}`);
  } catch (error) {
    console.error(`[Team Event Error] Failed to publish ${eventType}:`, error);
  }
}

/**
 * Publish license expiring event
 */
export async function publishLicenseExpiringEvent(
  staffId: string,
  email: string,
  displayName: string,
  license: { licenseType: string; licenseNumber: string; expiryDate: string },
  daysUntilExpiry: number,
  managerId?: string,
  managerEmail?: string
): Promise<void> {
  const client = getPublisherClient();

  const data = {
    staffId,
    email,
    displayName,
    license,
    daysUntilExpiry,
    managerId,
    managerEmail,
  };

  if (!client) {
    console.log(`[License Expiring Event]:`, data);
    return;
  }

  try {
    await client.send([
      {
        eventType: STAFF_EVENTS.STAFF_LICENSE_EXPIRING,
        subject: `/staff/${staffId}/license`,
        dataVersion: '1.0',
        data: {
          ...data,
          timestamp: new Date().toISOString(),
        },
      },
    ]);
    console.log(`[License Expiring Published] ${staffId} - ${license.licenseType}`);
  } catch (error) {
    console.error('[License Event Error] Failed to publish:', error);
  }
}

/**
 * Reset publisher client (for testing)
 */
export function resetPublisherClient(): void {
  publisherClient = null;
}

