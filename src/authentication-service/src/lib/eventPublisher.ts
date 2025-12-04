/**
 * Event Publisher - Publishes events to Azure Event Grid
 */

import { EventGridPublisherClient, AzureKeyCredential } from '@azure/eventgrid';
import { getConfig } from './config';

// Event Grid client singleton
let _client: EventGridPublisherClient<'EventGrid'> | null = null;

/**
 * Get Event Grid client
 */
function getEventGridClient(): EventGridPublisherClient<'EventGrid'> | null {
  if (!_client) {
    const config = getConfig();
    
    if (!config.eventGrid.topicEndpoint || !config.eventGrid.topicKey) {
      return null;
    }
    
    _client = new EventGridPublisherClient(
      config.eventGrid.topicEndpoint,
      'EventGrid',
      new AzureKeyCredential(config.eventGrid.topicKey)
    );
  }
  
  return _client;
}

/**
 * Base event data structure
 */
interface BaseEventData {
  correlationId?: string;
  serviceName: string;
  requestId?: string;
  timestamp: string;
}

/**
 * User logged in event
 */
export interface UserLoggedInEventData extends BaseEventData {
  userId: string;
  email: string;
  name: string;
  authMethod: string;
  sessionId: string;
  azureAdGroups: string[];
  ipAddress: string;
  userAgent: string;
  loginTime: string;
}

/**
 * User logged out event
 */
export interface UserLoggedOutEventData extends BaseEventData {
  userId: string;
  email: string;
  sessionId: string;
  logoutType: 'user_initiated' | 'all_sessions' | 'token_reuse_detected' | 'session_expired';
  sessionsInvalidated: number;
}

/**
 * Login failed event
 */
export interface LoginFailedEventData extends BaseEventData {
  email: string;
  reason: string;
  ipAddress: string;
  userAgent: string;
  attemptNumber: number;
  lockoutTriggered: boolean;
}

/**
 * Session created event
 */
export interface SessionCreatedEventData extends BaseEventData {
  userId: string;
  email: string;
  sessionId: string;
  deviceInfo: string;
  expiresAt: string;
}

/**
 * Token refreshed event
 */
export interface TokenRefreshedEventData extends BaseEventData {
  userId: string;
  sessionId: string;
  newExpiresAt: string;
}

/**
 * Publish event to Event Grid
 */
async function publishEvent(
  eventType: string,
  subject: string,
  data: object
): Promise<void> {
  const client = getEventGridClient();
  
  // Skip if Event Grid is not configured
  if (!client) {
    console.log(`[EventPublisher] Event Grid not configured, skipping event: ${eventType}`);
    return;
  }
  
  const event = {
    eventType,
    subject,
    dataVersion: '1.0',
    data,
  };
  
  try {
    await client.send([event]);
    console.log(`[EventPublisher] Published event: ${eventType}`);
  } catch (error) {
    console.error(`[EventPublisher] Failed to publish event: ${eventType}`, error);
    // Don't throw - event publishing should not break the main flow
  }
}

/**
 * Publish user logged in event
 */
export async function publishUserLoggedInEvent(data: UserLoggedInEventData): Promise<void> {
  await publishEvent(
    'auth.user.logged_in',
    `/users/${data.userId}`,
    data
  );
}

/**
 * Publish user logged out event
 */
export async function publishUserLoggedOutEvent(data: UserLoggedOutEventData): Promise<void> {
  await publishEvent(
    'auth.user.logged_out',
    `/users/${data.userId}`,
    data
  );
}

/**
 * Publish login failed event
 */
export async function publishLoginFailedEvent(data: LoginFailedEventData): Promise<void> {
  await publishEvent(
    'auth.login.failed',
    `/auth/login`,
    data
  );
}

/**
 * Publish session created event
 */
export async function publishSessionCreatedEvent(data: SessionCreatedEventData): Promise<void> {
  await publishEvent(
    'auth.session.created',
    `/users/${data.userId}/sessions/${data.sessionId}`,
    data
  );
}

/**
 * Publish token refreshed event
 */
export async function publishTokenRefreshedEvent(data: TokenRefreshedEventData): Promise<void> {
  await publishEvent(
    'auth.token.refreshed',
    `/users/${data.userId}/sessions/${data.sessionId}`,
    data
  );
}

/**
 * Create base event data
 */
export function createBaseEventData(requestId?: string, correlationId?: string): BaseEventData {
  return {
    serviceName: 'authentication-service',
    requestId,
    correlationId,
    timestamp: new Date().toISOString(),
  };
}
