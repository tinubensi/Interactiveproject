/**
 * Security Alerter - Detect and alert on critical security events
 */

import { EventGridEvent } from './eventMapper';

/**
 * Security alert types
 */
export type SecurityAlertType =
  | 'brute_force_attempt'
  | 'sensitive_access_denied'
  | 'high_privilege_role_assigned'
  | 'token_reuse_attack'
  | 'mass_data_access'
  | 'unusual_activity';

/**
 * Security alert severity
 */
export type AlertSeverity = 'high' | 'critical';

/**
 * Security alert
 */
export interface SecurityAlert {
  alertType: SecurityAlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  sourceEvent: {
    type: string;
    id: string;
  };
  actor?: {
    userId?: string;
    email?: string;
    ipAddress?: string;
  };
  timestamp: string;
  recommendedAction: string;
}

/**
 * Critical event pattern definition
 */
interface CriticalEventPattern {
  eventType: string | RegExp;
  condition: (event: EventGridEvent) => boolean;
  alertType: SecurityAlertType;
  severity: AlertSeverity;
  title: string;
  descriptionTemplate: (event: EventGridEvent) => string;
  recommendedAction: string;
}

/**
 * High privilege roles that trigger alerts when assigned
 */
const HIGH_PRIVILEGE_ROLES = ['super-admin', 'compliance-officer', 'broker-manager'];

/**
 * Sensitive resource types
 */
const SENSITIVE_RESOURCES = ['audit', 'compliance', 'financial'];

/**
 * Critical event patterns
 */
const CRITICAL_EVENT_PATTERNS: CriticalEventPattern[] = [
  {
    eventType: 'auth.login.failed',
    condition: (event) => {
      const attemptNumber = event.data.attemptNumber as number;
      return attemptNumber >= 5;
    },
    alertType: 'brute_force_attempt',
    severity: 'critical',
    title: 'Multiple Failed Login Attempts Detected',
    descriptionTemplate: (event) => {
      const attempts = event.data.attemptNumber || 'multiple';
      const ip = event.data.ipAddress || 'unknown';
      const email = event.data.email || 'unknown user';
      return `${attempts} failed login attempts from IP ${ip} for ${email}`;
    },
    recommendedAction: 'Review account activity and consider temporary lockout',
  },
  {
    eventType: 'permission.denied',
    condition: (event) => {
      const resourceType = (event.data.resource as Record<string, unknown>)?.type as string;
      return SENSITIVE_RESOURCES.includes(resourceType);
    },
    alertType: 'sensitive_access_denied',
    severity: 'high',
    title: 'Sensitive Resource Access Denied',
    descriptionTemplate: (event) => {
      const userId = event.data.userId || 'unknown';
      const resource = (event.data.resource as Record<string, unknown>)?.type || 'sensitive';
      const permission = event.data.permission || 'unknown';
      return `User ${userId} was denied ${permission} access to ${resource} resource`;
    },
    recommendedAction: 'Review user permissions and verify access attempt is legitimate',
  },
  {
    eventType: 'role.assigned',
    condition: (event) => {
      const roleId = event.data.roleId as string;
      return HIGH_PRIVILEGE_ROLES.includes(roleId);
    },
    alertType: 'high_privilege_role_assigned',
    severity: 'high',
    title: 'High Privilege Role Assigned',
    descriptionTemplate: (event) => {
      const roleId = event.data.roleId || 'unknown';
      const userId = event.data.userId || 'unknown';
      const assignedBy = event.data.assignedBy || 'unknown';
      return `Role ${roleId} assigned to user ${userId} by ${assignedBy}`;
    },
    recommendedAction: 'Verify the role assignment was authorized and appropriate',
  },
  {
    eventType: 'auth.user.logged_out',
    condition: (event) => {
      return event.data.logoutType === 'token_reuse_detected';
    },
    alertType: 'token_reuse_attack',
    severity: 'critical',
    title: 'Token Reuse Attack Detected',
    descriptionTemplate: (event) => {
      const userId = event.data.userId || 'unknown';
      const ip = event.data.ipAddress || 'unknown';
      return `Potential token reuse attack detected for user ${userId} from IP ${ip}`;
    },
    recommendedAction: 'Invalidate all user sessions and notify the user immediately',
  },
];

/**
 * Check if an event matches a pattern
 */
function matchesPattern(event: EventGridEvent, pattern: CriticalEventPattern): boolean {
  // Check event type
  if (typeof pattern.eventType === 'string') {
    if (event.eventType !== pattern.eventType) {
      return false;
    }
  } else if (!pattern.eventType.test(event.eventType)) {
    return false;
  }

  // Check condition
  return pattern.condition(event);
}

/**
 * Check if an event is a critical security event
 */
export function isCriticalSecurityEvent(event: EventGridEvent): boolean {
  return CRITICAL_EVENT_PATTERNS.some((pattern) => matchesPattern(event, pattern));
}

/**
 * Generate a security alert from an event
 */
export function generateSecurityAlert(event: EventGridEvent): SecurityAlert | null {
  for (const pattern of CRITICAL_EVENT_PATTERNS) {
    if (matchesPattern(event, pattern)) {
      return {
        alertType: pattern.alertType,
        severity: pattern.severity,
        title: pattern.title,
        description: pattern.descriptionTemplate(event),
        sourceEvent: {
          type: event.eventType,
          id: event.id,
        },
        actor: {
          userId: event.data.userId as string | undefined,
          email: event.data.email as string | undefined,
          ipAddress: event.data.ipAddress as string | undefined,
        },
        timestamp: new Date().toISOString(),
        recommendedAction: pattern.recommendedAction,
      };
    }
  }

  return null;
}

/**
 * Get all patterns (for testing)
 */
export function getCriticalEventPatterns(): CriticalEventPattern[] {
  return [...CRITICAL_EVENT_PATTERNS];
}

/**
 * Check if a role is high privilege
 */
export function isHighPrivilegeRole(roleId: string): boolean {
  return HIGH_PRIVILEGE_ROLES.includes(roleId);
}

/**
 * Check if a resource type is sensitive
 */
export function isSensitiveResource(resourceType: string): boolean {
  return SENSITIVE_RESOURCES.includes(resourceType);
}

