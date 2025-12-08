/**
 * Workload Service - Handle workload calculations and capacity checks
 */

import { Workload, StaffMemberDocument } from '../models/StaffMember';
import { getConfig } from './config';

/**
 * Workload status
 */
export type WorkloadStatus = 'available' | 'warning' | 'at_capacity' | 'over_capacity';

/**
 * Workload breakdown
 */
export interface WorkloadBreakdown {
  leads: {
    current: number;
    max: number;
    available: number;
  };
  customers: {
    current: number;
    max: number;
    available: number;
  };
  policies: {
    current: number;
  };
  pendingApprovals: number;
}

/**
 * Capacity check result
 */
export interface CapacityCheckResult {
  canAccept: boolean;
  status: WorkloadStatus;
  utilizationRate: number;
  reason?: string;
}

// Default values for testing and fallback
const DEFAULT_MAX_LEADS = 20;
const DEFAULT_MAX_CUSTOMERS = 60;
const DEFAULT_WARNING_THRESHOLD = 0.8;
const DEFAULT_BLOCK_THRESHOLD = 1.0;

/**
 * Get default workload limits
 */
export function getDefaultWorkloadLimits(): { maxLeads: number; maxCustomers: number } {
  try {
    const config = getConfig();
    return {
      maxLeads: config.workload.defaultMaxLeads,
      maxCustomers: config.workload.defaultMaxCustomers,
    };
  } catch {
    // Return defaults for testing
    return {
      maxLeads: DEFAULT_MAX_LEADS,
      maxCustomers: DEFAULT_MAX_CUSTOMERS,
    };
  }
}

/**
 * Get workload thresholds
 */
export function getWorkloadThresholds(): { warning: number; block: number } {
  try {
    const config = getConfig();
    return {
      warning: config.workload.warningThreshold,
      block: config.workload.blockThreshold,
    };
  } catch {
    // Return defaults for testing
    return {
      warning: DEFAULT_WARNING_THRESHOLD,
      block: DEFAULT_BLOCK_THRESHOLD,
    };
  }
}

/**
 * Calculate utilization rate for leads
 */
export function calculateLeadUtilization(workload: Workload): number {
  const maxLeads = workload.maxLeads || getDefaultWorkloadLimits().maxLeads;
  if (maxLeads === 0) return 0;
  return workload.activeLeads / maxLeads;
}

/**
 * Calculate utilization rate for customers
 */
export function calculateCustomerUtilization(workload: Workload): number {
  const maxCustomers = workload.maxCustomers || getDefaultWorkloadLimits().maxCustomers;
  if (maxCustomers === 0) return 0;
  return workload.activeCustomers / maxCustomers;
}

/**
 * Calculate overall utilization rate (average of leads and customers)
 */
export function calculateOverallUtilization(workload: Workload): number {
  const leadUtil = calculateLeadUtilization(workload);
  const customerUtil = calculateCustomerUtilization(workload);
  return (leadUtil + customerUtil) / 2;
}

/**
 * Get workload status based on utilization
 */
export function getWorkloadStatus(utilization: number): WorkloadStatus {
  const thresholds = getWorkloadThresholds();
  
  if (utilization >= thresholds.block) {
    return utilization > thresholds.block ? 'over_capacity' : 'at_capacity';
  }
  if (utilization >= thresholds.warning) {
    return 'warning';
  }
  return 'available';
}

/**
 * Check if staff can accept new leads
 */
export function canAcceptNewLead(staff: StaffMemberDocument): CapacityCheckResult {
  const utilization = calculateLeadUtilization(staff.workload);
  const status = getWorkloadStatus(utilization);
  const thresholds = getWorkloadThresholds();
  
  const canAccept = utilization < thresholds.block;
  
  return {
    canAccept,
    status,
    utilizationRate: utilization,
    reason: canAccept 
      ? undefined 
      : `Lead capacity reached (${Math.round(utilization * 100)}%)`,
  };
}

/**
 * Check if staff can accept new customers
 */
export function canAcceptNewCustomer(staff: StaffMemberDocument): CapacityCheckResult {
  const utilization = calculateCustomerUtilization(staff.workload);
  const status = getWorkloadStatus(utilization);
  const thresholds = getWorkloadThresholds();
  
  const canAccept = utilization < thresholds.block;
  
  return {
    canAccept,
    status,
    utilizationRate: utilization,
    reason: canAccept 
      ? undefined 
      : `Customer capacity reached (${Math.round(utilization * 100)}%)`,
  };
}

/**
 * Get workload breakdown for staff
 */
export function getWorkloadBreakdown(staff: StaffMemberDocument): WorkloadBreakdown {
  const defaults = getDefaultWorkloadLimits();
  const maxLeads = staff.workload.maxLeads || defaults.maxLeads;
  const maxCustomers = staff.workload.maxCustomers || defaults.maxCustomers;
  
  return {
    leads: {
      current: staff.workload.activeLeads,
      max: maxLeads,
      available: Math.max(0, maxLeads - staff.workload.activeLeads),
    },
    customers: {
      current: staff.workload.activeCustomers,
      max: maxCustomers,
      available: Math.max(0, maxCustomers - staff.workload.activeCustomers),
    },
    policies: {
      current: staff.workload.activePolicies,
    },
    pendingApprovals: staff.workload.pendingApprovals,
  };
}

/**
 * Get full workload info for API response
 */
export function getWorkloadInfo(staff: StaffMemberDocument): {
  workload: Workload & { utilizationRate: number };
  breakdown: WorkloadBreakdown;
  availability: {
    isAvailable: boolean;
    canAcceptNewLeads: boolean;
    canAcceptNewCustomers: boolean;
  };
} {
  const breakdown = getWorkloadBreakdown(staff);
  const leadCapacity = canAcceptNewLead(staff);
  const customerCapacity = canAcceptNewCustomer(staff);
  const utilizationRate = calculateOverallUtilization(staff.workload);
  
  return {
    workload: {
      ...staff.workload,
      utilizationRate,
    },
    breakdown,
    availability: {
      isAvailable: staff.availability.isAvailable,
      canAcceptNewLeads: leadCapacity.canAccept && staff.availability.isAvailable,
      canAcceptNewCustomers: customerCapacity.canAccept && staff.availability.isAvailable,
    },
  };
}

/**
 * Increment workload counter
 */
export function incrementWorkload(
  workload: Workload,
  field: 'activeLeads' | 'activeCustomers' | 'activePolicies' | 'pendingApprovals'
): Workload {
  return {
    ...workload,
    [field]: workload[field] + 1,
  };
}

/**
 * Decrement workload counter
 */
export function decrementWorkload(
  workload: Workload,
  field: 'activeLeads' | 'activeCustomers' | 'activePolicies' | 'pendingApprovals'
): Workload {
  return {
    ...workload,
    [field]: Math.max(0, workload[field] - 1),
  };
}

