/**
 * Event Mapper - Map Event Grid events to Audit Log entries
 */

import { AuditCategory, AuditSeverity, AuditActor, AuditContext, ActorType } from '../models/AuditLog';

/**
 * Event Grid event structure
 */
export interface EventGridEvent {
  id: string;
  eventType: string;
  subject: string;
  eventTime: string;
  data: Record<string, unknown>;
  dataVersion?: string;
  metadataVersion?: string;
  topic?: string;
}

/**
 * Event type to category mapping
 */
const EVENT_CATEGORY_MAP: Record<string, AuditCategory> = {
  // Authentication events
  'auth.user.logged_in': 'authentication',
  'auth.user.logged_out': 'authentication',
  'auth.session.created': 'authentication',
  'auth.session.expired': 'authentication',
  'auth.session.revoked': 'authentication',
  'auth.token.refreshed': 'authentication',
  'auth.login.failed': 'security_event',
  
  // Authorization events
  'role.created': 'authorization',
  'role.updated': 'authorization',
  'role.deleted': 'authorization',
  'role.assigned': 'authorization',
  'role.removed': 'authorization',
  'permission.denied': 'security_event',
  'permission.temp.granted': 'authorization',
  'permission.temp.revoked': 'authorization',
  
  // Document events
  'document.uploaded': 'data_mutation',
  'document.downloaded': 'data_access',
  'document.deleted': 'data_mutation',
  'document.viewed': 'data_access',
  
  // Workflow events
  'workflow.created': 'system',
  'workflow.started': 'system',
  'workflow.completed': 'system',
  'workflow.cancelled': 'system',
  'approval.requested': 'system',
  'approval.approved': 'system',
  'approval.rejected': 'system',
  
  // Security events
  'security.alert.triggered': 'security_event',
};

/**
 * Event types that indicate critical severity
 */
const CRITICAL_EVENT_TYPES = [
  'auth.login.failed',
  'security.alert.triggered',
];

/**
 * Event types that indicate warning severity
 */
const WARNING_EVENT_TYPES = [
  'permission.denied',
  'auth.session.revoked',
];

/**
 * Extract entity type from event type string
 */
export function extractEntityType(eventType: string): string {
  // Event format: "domain.entity.action" or "entity.action"
  const parts = eventType.split('.');
  
  if (parts.length >= 2) {
    // Return the first part as entity type
    return parts[0];
  }
  
  return 'unknown';
}

/**
 * Extract entity ID from event subject
 */
export function extractEntityId(subject: string): string {
  // Subject format: "/entities/{entityType}/{entityId}" or "/{entityType}/{id}"
  const parts = subject.split('/').filter(Boolean);
  
  if (parts.length >= 2) {
    return parts[parts.length - 1];
  }
  
  return subject || 'unknown';
}

/**
 * Extract action from event type string
 */
export function extractAction(eventType: string): string {
  // Event format: "domain.entity.action" or "entity.action"
  const parts = eventType.split('.');
  
  if (parts.length >= 2) {
    // Return the last part as action
    return parts[parts.length - 1];
  }
  
  return eventType;
}

/**
 * Map event type to audit category
 */
export function mapToCategory(eventType: string): AuditCategory {
  // Check exact match first
  if (EVENT_CATEGORY_MAP[eventType]) {
    return EVENT_CATEGORY_MAP[eventType];
  }
  
  // Check prefix matches
  const entityType = extractEntityType(eventType);
  const action = extractAction(eventType);
  
  // Default category mapping based on entity type
  switch (entityType) {
    case 'auth':
      return action === 'failed' ? 'security_event' : 'authentication';
    case 'role':
    case 'permission':
      return 'authorization';
    case 'document':
      return ['downloaded', 'viewed', 'accessed'].includes(action) ? 'data_access' : 'data_mutation';
    case 'workflow':
    case 'approval':
      return 'system';
    case 'payment':
    case 'refund':
    case 'invoice':
      return 'financial';
    case 'compliance':
    case 'aml':
    case 'kyc':
      return 'compliance';
    default:
      // Default to data_mutation for CRUD operations
      if (['created', 'updated', 'deleted'].includes(action)) {
        return 'data_mutation';
      }
      return 'data_mutation';
  }
}

/**
 * Determine severity based on event type and data
 */
export function determineSeverity(eventType: string, data: Record<string, unknown>): AuditSeverity {
  // Critical events
  if (CRITICAL_EVENT_TYPES.some((e) => eventType.includes(e))) {
    return 'critical';
  }
  
  // Check for multiple failed attempts
  if (eventType.includes('failed') && typeof data.attemptNumber === 'number' && data.attemptNumber >= 5) {
    return 'critical';
  }
  
  // Warning events
  if (WARNING_EVENT_TYPES.some((e) => eventType.includes(e))) {
    return 'warning';
  }
  
  // Check for sensitive resource access denial
  if (eventType === 'permission.denied') {
    const resourceType = (data.resource as Record<string, unknown>)?.type;
    if (['audit', 'compliance', 'financial'].includes(resourceType as string)) {
      return 'warning';
    }
  }
  
  return 'info';
}

/**
 * Extract actor information from event data
 */
export function extractActor(data: Record<string, unknown>): AuditActor {
  // Try different common field patterns
  const userId = (data.userId || data.actorId || data.performedBy || 'system') as string;
  const email = (data.email || data.userEmail || data.actorEmail || '') as string;
  const name = (data.name || data.userName || data.actorName) as string | undefined;
  const roles = data.roles as string[] | undefined;
  
  // Determine actor type
  let actorType: ActorType = 'user';
  if (userId === 'system' || userId.startsWith('system-')) {
    actorType = 'system';
  } else if (userId.includes('service') || data.serviceName) {
    actorType = 'service';
  }
  
  return {
    id: userId,
    email,
    name,
    roles,
    type: actorType,
  };
}

/**
 * Extract changes from event data
 */
export function extractChanges(data: Record<string, unknown>): {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changedFields?: string[];
} | undefined {
  const before = data.before as Record<string, unknown> | undefined;
  const after = data.after as Record<string, unknown> | undefined;
  const changedFields = data.changedFields as string[] | undefined;
  
  if (!before && !after && !changedFields) {
    return undefined;
  }
  
  // If changedFields not provided, compute from before/after
  let fields = changedFields;
  if (!fields && before && after) {
    fields = Object.keys(after).filter((key) => {
      return JSON.stringify(before[key]) !== JSON.stringify(after[key]);
    });
  }
  
  return {
    before,
    after,
    changedFields: fields,
  };
}

/**
 * Extract context from event data
 */
export function extractContext(
  event: EventGridEvent,
  data: Record<string, unknown>
): AuditContext {
  return {
    ipAddress: (data.ipAddress || data.clientIp || 'unknown') as string,
    userAgent: (data.userAgent || 'unknown') as string,
    requestId: (data.requestId || event.id) as string,
    serviceName: extractServiceName(event.topic || ''),
    correlationId: data.correlationId as string | undefined,
  };
}

/**
 * Extract service name from event topic or source
 */
export function extractServiceName(topic: string): string {
  if (!topic) {
    return 'unknown';
  }
  
  // Topic format: "/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.EventGrid/topics/{name}"
  const parts = topic.split('/');
  const topicName = parts[parts.length - 1];
  
  // Extract service name from topic name
  if (topicName.includes('-')) {
    return topicName.split('-')[0];
  }
  
  return topicName || 'unknown';
}

/**
 * Map an Event Grid event to audit log fields
 */
export function mapEventToAuditLog(event: EventGridEvent): {
  entityType: string;
  entityId: string;
  action: string;
  category: AuditCategory;
  severity: AuditSeverity;
  actor: AuditActor;
  changes?: ReturnType<typeof extractChanges>;
  context: AuditContext;
  metadata?: Record<string, unknown>;
  timestamp: string;
} {
  const data = event.data || {};
  
  return {
    entityType: extractEntityType(event.eventType),
    entityId: extractEntityId(event.subject),
    action: extractAction(event.eventType),
    category: mapToCategory(event.eventType),
    severity: determineSeverity(event.eventType, data),
    actor: extractActor(data),
    changes: extractChanges(data),
    context: extractContext(event, data),
    metadata: data.metadata as Record<string, unknown> | undefined,
    timestamp: event.eventTime,
  };
}

