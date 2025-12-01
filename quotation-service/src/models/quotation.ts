/**
 * Quotation Models
 * Reference: Petli quotation_batch and quotation_plan models
 * Adapted for all LOBs (Medical, Motor, General, Marine)
 */

export type LineOfBusiness = 'medical' | 'motor' | 'general' | 'marine';
export type QuotationStatus = 
  | 'draft'           // Initial creation
  | 'pending'         // Awaiting review
  | 'sent'            // Sent to customer
  | 'viewed'          // Customer viewed quotation
  | 'approved'        // Customer approved, ready for policy issuance
  | 'rejected'        // Customer rejected
  | 'expired'         // Validity period expired
  | 'superseded';     // Replaced by a newer revision

/**
 * Main Quotation Model
 * Represents a quotation batch with selected plans
 */
export interface Quotation {
  id: string;
  referenceId: string; // Human-readable (QUOT-2024-001)
  leadId: string; // Partition Key
  
  // References to other services
  customerId: string;
  planIds: string[]; // Selected plan IDs from PlanDB
  
  // LOB Context
  lineOfBusiness: LineOfBusiness;
  businessType: string; // 'individual', 'group'
  
  // Quotation Details
  totalPremium: number;
  currency: string;
  validUntil: Date;
  termsAndConditions: string;
  
  // Status and Lifecycle
  status: QuotationStatus;
  isCurrentVersion: boolean; // Latest version for this lead
  version: number; // 1, 2, 3... for revisions
  previousVersionId?: string; // Link to previous revision
  
  // Customer Interaction
  sentAt?: Date;
  sentTo?: string; // Email address
  viewedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  
  // PDF Document
  pdfUrl?: string; // Blob storage URL
  pdfGeneratedAt?: Date;
  
  // Remarks (from Petli)
  remarks?: {
    gettingPaymentLink?: string;
    verificationOfDocuments?: string;
    underwritingInformationMissing?: string;
    awaitingPolicyDocuments?: string;
    other?: string;
  };
  
  // Snapshot of lead data at time of quotation
  leadSnapshot?: any;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: Date;
}

/**
 * Quotation Plan (Snapshot)
 * Immutable copy of plan data at the time of quotation creation
 */
export interface QuotationPlan {
  id: string;
  quotationId: string; // Partition Key
  
  // Original Plan Reference
  planId: string; // Original ID from PlanDB
  leadId: string;
  
  // Vendor Information
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  
  // Plan Details (Snapshot)
  planName: string;
  planCode: string;
  planType: string;
  
  // Pricing
  annualPremium: number;
  monthlyPremium: number;
  currency: string;
  
  // Coverage
  annualLimit: number;
  deductible: number;
  deductibleMetric?: string;
  coInsurance: number;
  coInsuranceMetric?: string;
  waitingPeriod: number;
  waitingPeriodMetric?: string;
  
  // Full Plan Data (Snapshot)
  fullPlanData: any; // Complete plan object including benefits, exclusions
  
  // Selection
  isSelected: boolean; // Which plan customer chose for policy
  
  // Metadata
  createdAt: Date;
  generatedBy?: string;
}

/**
 * Quotation Revision
 * Tracks changes between quotation versions
 */
export interface QuotationRevision {
  id: string;
  quotationId: string; // Partition Key - new quotation ID
  previousQuotationId: string;
  leadId: string;
  
  version: number;
  
  // Changes Made
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
    reason?: string;
  }[];
  
  // Plan Changes
  plansAdded: string[]; // Plan IDs
  plansRemoved: string[]; // Plan IDs
  
  // Revision Reason
  reason: string;
  remarks?: string;
  
  // Metadata
  revisedAt: Date;
  revisedBy?: string;
}

/**
 * Quotation List Request DTO
 */
export interface QuotationListRequest {
  leadId?: string;
  customerId?: string;
  
  // Pagination
  page: number;
  limit: number;
  
  // Sorting
  sortBy?: 'createdAt' | 'sentAt' | 'totalPremium' | 'validUntil' | 'version';
  sortOrder?: 'asc' | 'desc';
  
  // Filters
  filters?: {
    status?: QuotationStatus[];
    lineOfBusiness?: LineOfBusiness[];
    isCurrentVersion?: boolean;
    dateRange?: {
      from: Date;
      to: Date;
    };
    minPremium?: number;
    maxPremium?: number;
  };
  
  // Search
  search?: string; // Search in referenceId, customerName, etc.
}

/**
 * Quotation List Response DTO
 */
export interface QuotationListResponse {
  data: Quotation[];
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
      statuses: Array<{ value: QuotationStatus; count: number }>;
      lobs: Array<{ value: LineOfBusiness; count: number }>;
    };
  };
  sort: {
    sortBy: string;
    sortOrder: string;
  };
  aggregations?: {
    totalQuotations: number;
    byStatus: Array<{ status: QuotationStatus; count: number }>;
    byLOB: Array<{ lob: LineOfBusiness; count: number }>;
    totalValue: number;
    avgPremium: number;
  };
}

/**
 * Create Quotation Request DTO
 */
export interface CreateQuotationRequest {
  leadId: string;
  customerId: string;
  planIds: string[]; // Selected plan IDs
  lineOfBusiness: LineOfBusiness;
  businessType: string;
  validityDays?: number; // Default 30 days
  termsAndConditions?: string;
  remarks?: Quotation['remarks'];
}

/**
 * Update Quotation Request DTO
 */
export interface UpdateQuotationRequest {
  status?: QuotationStatus;
  validUntil?: Date;
  termsAndConditions?: string;
  remarks?: Quotation['remarks'];
  rejectionReason?: string;
}

/**
 * Revise Quotation Request DTO
 */
export interface ReviseQuotationRequest {
  quotationId: string;
  planIds: string[]; // New selected plans
  reason: string;
  remarks?: string;
  changes?: Array<{
    field: string;
    oldValue: any;
    newValue: any;
    reason?: string;
  }>;
}

/**
 * Send Quotation Request DTO
 */
export interface SendQuotationRequest {
  quotationId: string;
  recipientEmail: string;
  recipientName: string;
  message?: string;
  ccEmails?: string[];
}

/**
 * Change Status Request DTO
 */
export interface ChangeStatusRequest {
  quotationId: string;
  status: QuotationStatus;
  reason?: string;
  remarks?: string;
}

/**
 * Select Plan Request DTO
 */
export interface SelectPlanRequest {
  quotationId: string;
  planId: string; // Which plan customer selected for policy
}


