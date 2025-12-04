/**
 * Policy Models
 * Reference: Petli PolicyIssuedRequest model
 * Adapted for all LOBs (Medical, Motor, General, Marine)
 */

export type LineOfBusiness = 'medical' | 'motor' | 'general' | 'marine';
export type PolicyRequestStatus = 
  | 'pending'        // Pending review
  | 'under_review'   // Being reviewed by underwriter
  | 'approved'       // Approved, policy being issued
  | 'rejected'       // Rejected
  | 'issued';        // Policy issued successfully

export type PolicyStatus =
  | 'active'
  | 'pending'
  | 'expired'
  | 'cancelled'
  | 'renewed';

export type DocumentType =
  | 'customer_id'
  | 'customer_passport'
  | 'customer_visa'
  | 'vehicle_registration'
  | 'vehicle_insurance_card'
  | 'medical_records'
  | 'pet_vaccination'
  | 'pet_passport'
  | 'building_valuation'
  | 'trade_license'
  | 'other';

/**
 * Policy Issuance Request
 * Represents a request to issue a policy from an approved quotation
 * Reference: Petli PolicyIssuedRequest
 */
export interface PolicyRequest {
  id: string;
  referenceId: string; // Human-readable (POL-REQ-2024-001)
  quotationId: string; // Partition Key
  
  // References
  leadId: string;
  customerId: string;
  selectedPlanId: string; // The plan selected from quotation
  
  // Vendor Information
  vendorId: string;
  vendorName: string;
  
  // LOB Context
  lineOfBusiness: LineOfBusiness;
  businessType: string;
  
  // Documents
  customerDocuments: PolicyDocument[];
  lobSpecificDocuments: PolicyDocument[]; // Pet docs, vehicle docs, etc.
  commonDocuments: PolicyDocument[];
  
  // Status and Workflow
  status: PolicyRequestStatus;
  submittedAt: Date;
  reviewedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  issuedAt?: Date;
  
  // Approval/Rejection Details
  reviewedBy?: string;
  rejectionReason?: string;
  remarks?: string;
  
  // Payment
  paymentStatus?: 'pending' | 'received' | 'failed';
  paymentReference?: string;
  paymentReceivedAt?: Date;
  
  // Issued Policy Reference
  policyId?: string;
  policyNumber?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

/**
 * Policy Document
 */
export interface PolicyDocument {
  id: string;
  documentType: DocumentType;
  documentName: string;
  blobUrl: string; // Azure Blob Storage URL
  uploadedAt: Date;
  uploadedBy?: string;
  fileSize: number; // in bytes
  mimeType: string;
  isVerified?: boolean;
  verifiedAt?: Date;
  verifiedBy?: string;
  remarks?: string;
}

/**
 * Issued Policy
 * Represents an active insurance policy
 */
export interface Policy {
  id: string;
  policyNumber: string; // Unique policy number
  customerId: string; // Partition Key
  
  // References
  leadId: string;
  quotationId: string;
  policyRequestId: string;
  planId: string;
  
  // Vendor Information
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  
  // LOB Context
  lineOfBusiness: LineOfBusiness;
  businessType: string;
  
  // Policy Details
  planName: string;
  planType: string;
  
  // Financial
  annualPremium: number;
  monthlyPremium: number;
  currency: string;
  
  // Coverage
  annualLimit: number;
  deductible: number;
  coInsurance: number;
  
  // Duration
  startDate: Date;
  endDate: Date;
  issueDate: Date;
  
  // Status
  status: PolicyStatus;
  
  // Documents
  policyDocument?: string; // PDF URL
  policyDocumentGeneratedAt?: Date;
  
  // Renewal
  isRenewable: boolean;
  renewalDate?: Date;
  renewedPolicyId?: string; // If this policy was renewed
  
  // Cancellation
  cancelledAt?: Date;
  cancellationReason?: string;
  
  // Full Data Snapshot
  fullPlanData: any; // Complete plan details at time of issuance
  quotationSnapshot?: any;
  leadSnapshot?: any;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Policy Request List Request DTO
 */
export interface PolicyRequestListRequest {
  quotationId?: string;
  leadId?: string;
  customerId?: string;
  
  // Pagination
  page: number;
  limit: number;
  
  // Sorting
  sortBy?: 'createdAt' | 'submittedAt' | 'status';
  sortOrder?: 'asc' | 'desc';
  
  // Filters
  filters?: {
    status?: PolicyRequestStatus[];
    lineOfBusiness?: LineOfBusiness[];
    vendorName?: string;
    dateRange?: {
      from: Date;
      to: Date;
    };
  };
}

/**
 * Policy Request List Response DTO
 */
export interface PolicyRequestListResponse {
  data: PolicyRequest[];
  pagination: {
    page: number;
    limit: number;
    totalRecords: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  filters: {
    applied: any;
    available: {
      statuses: Array<{ value: PolicyRequestStatus; count: number }>;
      vendors: Array<{ name: string; count: number }>;
    };
  };
  sort: {
    sortBy: string;
    sortOrder: string;
  };
}

/**
 * Policy List Request DTO
 */
export interface PolicyListRequest {
  customerId?: string;
  leadId?: string;
  
  // Pagination
  page: number;
  limit: number;
  
  // Sorting
  sortBy?: 'issueDate' | 'startDate' | 'endDate' | 'status';
  sortOrder?: 'asc' | 'desc';
  
  // Filters
  filters?: {
    status?: PolicyStatus[];
    lineOfBusiness?: LineOfBusiness[];
    vendorName?: string;
    isExpiringSoon?: boolean; // Within 30 days
  };
}

/**
 * Policy List Response DTO
 */
export interface PolicyListResponse {
  data: Policy[];
  pagination: {
    page: number;
    limit: number;
    totalRecords: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  filters: {
    applied: any;
    available: {
      statuses: Array<{ value: PolicyStatus; count: number }>;
      vendors: Array<{ name: string; count: number }>;
    };
  };
  sort: {
    sortBy: string;
    sortOrder: string;
  };
  aggregations?: {
    totalPolicies: number;
    activePolicies: number;
    expiringPolicies: number;
    totalValue: number;
  };
}

/**
 * Create Policy Request DTO
 */
export interface CreatePolicyRequestDTO {
  quotationId: string;
  leadId: string;
  customerId: string;
  selectedPlanId: string;
  vendorId: string;
  vendorName: string;
  lineOfBusiness: LineOfBusiness;
  businessType: string;
}

/**
 * Update Policy Request Status DTO
 */
export interface UpdatePolicyRequestStatusDTO {
  status: PolicyRequestStatus;
  remarks?: string;
  rejectionReason?: string;
  reviewedBy?: string;
}

/**
 * Upload Document DTO
 */
export interface UploadDocumentDTO {
  policyRequestId: string;
  documentType: DocumentType;
  documentName: string;
  file: Buffer;
  mimeType: string;
  category: 'customer' | 'lobSpecific' | 'common';
}


