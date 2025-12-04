/**
 * Audit Log - stored in Cosmos DB audit-logs container
 * Partition Key: /entityType
 * NO TTL - retained indefinitely for compliance
 */

/**
 * Audit categories for event classification
 */
export type AuditCategory =
  | 'authentication'    // Login, logout, token refresh
  | 'authorization'     // Permission checks, role changes
  | 'data_mutation'     // CRUD operations
  | 'data_access'       // Read operations on sensitive data
  | 'security_event'    // Failed logins, unauthorized access
  | 'compliance'        // AML checks, underwriting decisions
  | 'system'            // Configuration changes, deployments
  | 'financial';        // Payments, refunds

/**
 * Severity levels for audit events
 */
export type AuditSeverity = 'info' | 'warning' | 'critical';

/**
 * Actor types
 */
export type ActorType = 'user' | 'system' | 'service';

/**
 * Actor information - who performed the action
 */
export interface AuditActor {
  /** User ID or 'system' */
  id: string;
  
  /** User email */
  email: string;
  
  /** User display name */
  name?: string;
  
  /** User roles at time of action */
  roles?: string[];
  
  /** Actor type */
  type: ActorType;
}

/**
 * Change tracking for data mutations
 */
export interface AuditChanges {
  /** State before the change */
  before?: Record<string, unknown>;
  
  /** State after the change */
  after?: Record<string, unknown>;
  
  /** List of fields that changed */
  changedFields?: string[];
}

/**
 * Context information - where/how the action occurred
 */
export interface AuditContext {
  /** Client IP address */
  ipAddress: string;
  
  /** Client user agent string */
  userAgent: string;
  
  /** Request ID for tracing */
  requestId: string;
  
  /** Service that generated the event */
  serviceName: string;
  
  /** Correlation ID for distributed tracing */
  correlationId?: string;
}

/**
 * Audit Log Document
 */
export interface AuditLogDocument {
  /** Document ID (UUID) */
  id: string;
  
  /** Entity type - Partition key (e.g., 'auth', 'customer', 'staff') */
  entityType: string;
  
  /** ID of the affected entity */
  entityId: string;
  
  /** Action performed (e.g., 'created', 'updated', 'deleted', 'login') */
  action: string;
  
  /** Event category */
  category: AuditCategory;
  
  /** Event severity */
  severity: AuditSeverity;
  
  /** Who performed the action */
  actor: AuditActor;
  
  /** Change details (for mutations) */
  changes?: AuditChanges;
  
  /** Request context */
  context: AuditContext;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  
  /** Event timestamp (ISO 8601) */
  timestamp: string;
  
  /** Cosmos DB internal timestamp */
  _ts?: number;
}

/**
 * Request body for creating an audit log directly
 */
export interface CreateAuditLogRequest {
  entityType: string;
  entityId: string;
  action: string;
  category: AuditCategory;
  severity: AuditSeverity;
  actor: AuditActor;
  changes?: AuditChanges;
  context: Omit<AuditContext, 'requestId'> & { requestId?: string };
  metadata?: Record<string, unknown>;
}

/**
 * Query response for audit logs
 */
export interface AuditLogQueryResponse {
  entityType?: string;
  entityId?: string;
  userId?: string;
  email?: string;
  totalCount: number;
  logs: AuditLogDocument[];
  continuationToken?: string;
}

/**
 * Search request for audit logs
 */
export interface SearchAuditRequest {
  startDate: string;
  endDate: string;
  filters?: {
    entityType?: string;
    action?: string;
    actorId?: string;
    category?: AuditCategory;
    severity?: AuditSeverity;
  };
  limit?: number;
  continuationToken?: string;
}

