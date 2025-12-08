/**
 * Staff Member Model - stored in Cosmos DB staff-members container
 * Partition Key: /staffId
 */

/**
 * Staff types
 */
export type StaffType =
  | 'broker'
  | 'senior_broker'
  | 'broker_manager'
  | 'underwriter'
  | 'senior_underwriter'
  | 'customer_support'
  | 'compliance_officer'
  | 'admin';

/**
 * Staff status - with defined transitions
 */
export type StaffStatus =
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'on_leave'
  | 'terminated';

/**
 * License status
 */
export type LicenseStatus = 'active' | 'expired' | 'suspended' | 'pending_renewal';

/**
 * License information
 */
export interface License {
  licenseType: string;
  licenseNumber: string;
  issuingAuthority: string;
  issueDate: string;
  expiryDate: string;
  status: LicenseStatus;
}

/**
 * Workload tracking
 */
export interface Workload {
  activeLeads: number;
  activeCustomers: number;
  activePolicies: number;
  pendingApprovals: number;
  maxLeads?: number;
  maxCustomers?: number;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  period: string;
  leadsReceived?: number;
  leadsConverted: number;
  policiesIssued: number;
  premiumGenerated: number;
  customerSatisfaction?: number;
  averageResponseTime?: number;
}

/**
 * Availability status
 */
export interface Availability {
  isAvailable: boolean;
  awayUntil?: string;
  awayReason?: string;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  channels: {
    approvals: boolean;
    assignments: boolean;
    alerts: boolean;
    marketing: boolean;
  };
}

/**
 * Staff Member Document
 */
export interface StaffMemberDocument {
  /** Document ID (UUID) */
  id: string;

  /** Staff ID - Partition key (same as id) */
  staffId: string;

  /** Azure AD object ID */
  azureAdId: string;

  /** Email address */
  email: string;

  /** First name */
  firstName: string;

  /** Last name */
  lastName: string;

  /** Display name */
  displayName: string;

  /** Phone number */
  phone: string;

  /** Profile photo URL */
  photo?: string;

  /** Internal employee number */
  employeeId: string;

  /** Job title */
  jobTitle: string;

  /** Department */
  department: string;

  /** Staff type */
  staffType: StaffType;

  /** Hire date (ISO 8601) */
  hireDate: string;

  /** Current status */
  status: StaffStatus;

  /** When status was changed */
  statusChangedAt: string;

  /** Reason for status change */
  statusReason?: string;

  /** Team IDs (can belong to multiple teams) */
  teamIds: string[];

  /** Direct manager staff ID */
  managerId?: string;

  /** Organization ID */
  organizationId: string;

  /** Assigned territories */
  territories: string[];

  /** Licenses (for brokers) */
  licenses?: License[];

  /** Workload tracking */
  workload: Workload;

  /** Performance metrics */
  performance?: PerformanceMetrics;

  /** Availability status */
  availability: Availability;

  /** Notification preferences */
  notificationPreferences: NotificationPreferences;

  /** Additional metadata */
  metadata?: Record<string, unknown>;

  /** Created timestamp */
  createdAt: string;

  /** Created by user ID */
  createdBy: string;

  /** Updated timestamp */
  updatedAt: string;

  /** Updated by user ID */
  updatedBy: string;
}

/**
 * Create staff request
 */
export interface CreateStaffRequest {
  azureAdId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  photo?: string;
  employeeId: string;
  jobTitle: string;
  department: string;
  staffType: StaffType;
  hireDate: string;
  teamIds: string[];
  managerId?: string;
  organizationId?: string;
  territories?: string[];
  licenses?: License[];
  maxLeads?: number;
  maxCustomers?: number;
  notificationPreferences?: Partial<NotificationPreferences>;
  metadata?: Record<string, unknown>;
}

/**
 * Update staff request
 */
export interface UpdateStaffRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  photo?: string;
  jobTitle?: string;
  department?: string;
  staffType?: StaffType;
  managerId?: string;
  licenses?: License[];
  maxLeads?: number;
  maxCustomers?: number;
  notificationPreferences?: Partial<NotificationPreferences>;
  metadata?: Record<string, unknown>;
}

/**
 * Update staff status request
 */
export interface UpdateStaffStatusRequest {
  status: StaffStatus;
  reason?: string;
  awayUntil?: string;
}

/**
 * Staff list query parameters
 */
export interface StaffListQuery {
  teamId?: string;
  territory?: string;
  staffType?: StaffType;
  status?: StaffStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Staff list response
 */
export interface StaffListResponse {
  total: number;
  limit: number;
  offset: number;
  staff: StaffSummary[];
}

/**
 * Staff summary (for list responses)
 */
export interface StaffSummary {
  staffId: string;
  displayName: string;
  email: string;
  staffType: StaffType;
  status: StaffStatus;
  teamIds: string[];
  territories: string[];
  workload: Workload;
}

/**
 * Valid status transitions
 */
export const STATUS_TRANSITIONS: Record<StaffStatus, StaffStatus[]> = {
  active: ['inactive', 'suspended', 'on_leave', 'terminated'],
  inactive: ['active', 'terminated'],
  suspended: ['active', 'terminated'],
  on_leave: ['active'],
  terminated: [], // Terminal state - no transitions
};

