/**
 * Status Service - Handle staff status transitions
 */

import { StaffStatus, StaffMemberDocument, Availability } from '../models/StaffMember';
import { validateStatusTransition, ValidationResult } from './validators';

/**
 * Status change result
 */
export interface StatusChangeResult {
  previousStatus: StaffStatus;
  currentStatus: StaffStatus;
  statusChangedAt: string;
  availability: Availability;
  reason?: string;
}

/**
 * Apply status change to a staff member
 */
export function applyStatusChange(
  staff: StaffMemberDocument,
  targetStatus: StaffStatus,
  reason?: string,
  awayUntil?: string
): StatusChangeResult {
  const validation = validateStatusTransition(staff.status, targetStatus);
  
  if (!validation.valid) {
    throw new Error(validation.errors.join('; '));
  }

  const now = new Date().toISOString();
  const previousStatus = staff.status;

  // Calculate new availability based on status
  const availability = calculateAvailability(targetStatus, awayUntil, reason);

  return {
    previousStatus,
    currentStatus: targetStatus,
    statusChangedAt: now,
    availability,
    reason,
  };
}

/**
 * Calculate availability based on status
 */
export function calculateAvailability(
  status: StaffStatus,
  awayUntil?: string,
  awayReason?: string
): Availability {
  switch (status) {
    case 'active':
      return {
        isAvailable: true,
        awayUntil: undefined,
        awayReason: undefined,
      };
    case 'on_leave':
      return {
        isAvailable: false,
        awayUntil,
        awayReason: awayReason || 'On leave',
      };
    case 'inactive':
    case 'suspended':
    case 'terminated':
      return {
        isAvailable: false,
        awayUntil: undefined,
        awayReason: awayReason || `Status: ${status}`,
      };
    default:
      return {
        isAvailable: false,
      };
  }
}

/**
 * Check if status allows work assignments
 */
export function canAcceptAssignments(status: StaffStatus): boolean {
  return status === 'active';
}

/**
 * Check if status change requires workload reassignment
 */
export function requiresWorkloadReassignment(
  previousStatus: StaffStatus,
  newStatus: StaffStatus
): boolean {
  // If moving from active to any non-active state, may need reassignment
  if (previousStatus === 'active' && newStatus !== 'active') {
    return true;
  }
  return false;
}

/**
 * Get status display label
 */
export function getStatusLabel(status: StaffStatus): string {
  const labels: Record<StaffStatus, string> = {
    active: 'Active',
    inactive: 'Inactive',
    suspended: 'Suspended',
    on_leave: 'On Leave',
    terminated: 'Terminated',
  };
  return labels[status] || status;
}

/**
 * Validate status-based restrictions
 */
export function validateStatusRestrictions(
  staff: StaffMemberDocument,
  operation: 'assign_lead' | 'assign_customer' | 'assign_policy'
): ValidationResult {
  const errors: string[] = [];

  if (!canAcceptAssignments(staff.status)) {
    errors.push(
      `Cannot ${operation.replace('_', ' ')} to staff with status: ${getStatusLabel(staff.status)}`
    );
  }

  if (!staff.availability.isAvailable) {
    const reason = staff.availability.awayReason || 'unavailable';
    errors.push(`Staff is currently ${reason}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

