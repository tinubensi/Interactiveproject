/**
 * Plan Models
 * Reference: Petli plan.js model
 * Designed to work with all LOBs (Medical, Motor, General, Marine)
 */

export type LineOfBusiness = 'medical' | 'motor' | 'general' | 'marine';
export type PlanSource = 'static' | 'rpa' | 'api';

/**
 * Plan Model - Core insurance plan
 */
export interface Plan {
  id: string;
  leadId: string; // Partition Key - plans are always fetched for a specific lead
  
  // Vendor Information
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  
  // Plan Details
  planName: string;
  planCode: string;
  planType: string; // 'comprehensive', 'third-party', 'basic', 'premium', etc.
  
  // Pricing (from Petli plan model)
  annualPremium: number; // premium_amount
  monthlyPremium: number; // monthly_amount
  currency: string;
  
  // Coverage Details (from Petli plan model)
  annualLimit: number; // aggregate_limit
  deductible: number;
  deductibleMetric?: string; // 'AED', 'percentage', etc.
  coInsurance: number; // percentage (0-100)
  coInsuranceMetric?: string;
  waitingPeriod: number; // days
  waitingPeriodMetric?: string;
  
  // Benefits Structure
  benefits: BenefitCategory[];
  exclusions: string[];
  
  // Additional Coverage (optional)
  addons?: Addon[];
  
  // LOB-Specific Data
  lineOfBusiness: LineOfBusiness;
  lobSpecificData?: any; // Flexible field for LOB-specific information
  
  // Status Flags
  isAvailable: boolean;
  isSelected: boolean; // Selected for quotation
  isRecommended: boolean; // Recommended by system
  
  // Tracking
  fetchRequestId: string; // Reference to PlanDB.fetchRequests
  fetchedAt: Date;
  source: PlanSource;
  
  // References
  quotationId?: string; // Set when used in a quotation
  
  // Raw Data (for debugging/audit)
  rawPlanData?: any; // Original response from vendor/RPA
}

/**
 * Benefit Category
 */
export interface BenefitCategory {
  categoryId: string;
  categoryName: string; // 'Accident Coverage', 'Medical Coverage', etc.
  benefits: BenefitDetail[];
}

/**
 * Benefit Detail
 */
export interface BenefitDetail {
  benefitId?: string;
  name: string;
  covered: boolean;
  limit?: number;
  limitMetric?: string; // 'AED', 'percentage', 'days', etc.
  description?: string;
  subBenefits?: BenefitDetail[];
}

/**
 * Plan Addon
 */
export interface Addon {
  addonId: string;
  name: string;
  description: string;
  additionalPremium: number;
  benefits: BenefitDetail[];
}

/**
 * Plan Fetch Request
 * Tracks the process of fetching plans for a lead
 */
export interface PlanFetchRequest {
  id: string;
  leadId: string; // Partition Key
  
  // Lead Context
  lineOfBusiness: LineOfBusiness;
  businessType: string;
  leadData: any; // Lead details needed for plan calculation
  
  // Status
  status: 'pending' | 'fetching' | 'completed' | 'failed';
  
  // Vendors
  totalVendors: number;
  successfulVendors: string[];
  failedVendors: string[];
  unavailableVendors: string[];
  
  // Results
  totalPlansFound: number;
  
  // Error Tracking
  errors?: Array<{
    vendorId: string;
    vendorName: string;
    error: string;
    timestamp: Date;
  }>;
  
  // Timestamps
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Plan Filter
 * User-defined filter criteria
 */
export interface PlanFilter {
  id: string;
  leadId: string; // Partition Key
  
  // Pricing Filters
  annualPremium?: { min?: number; max?: number };
  monthlyPremium?: { min?: number; max?: number };
  
  // Coverage Filters
  annualLimit?: { min?: number; max?: number };
  deductible?: { min?: number; max?: number };
  coInsurance?: { min?: number; max?: number };
  waitingPeriod?: { min?: number; max?: number };
  
  // Vendor Filters
  selectedVendors?: string[]; // Array of vendor IDs
  excludedVendors?: string[];
  
  // Plan Type Filters
  planTypes?: string[];
  
  // Benefit Filters
  requiredBenefits?: string[]; // Must have these benefits
  excludedBenefits?: string[]; // Must not have these benefits
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Plan Comparison
 * Side-by-side comparison of selected plans
 */
export interface PlanComparison {
  id: string;
  leadId: string; // Partition Key
  
  // Plans being compared (max 5)
  planIds: string[];
  
  // Comparison Matrix
  comparisonMatrix: ComparisonRow[];
  
  // Metadata
  createdAt: Date;
}

/**
 * Comparison Row
 */
export interface ComparisonRow {
  feature: string; // 'Annual Premium', 'Deductible', etc.
  category: string; // 'Pricing', 'Coverage', 'Benefits', etc.
  plans: Record<string, any>; // planId -> value mapping
}

/**
 * Vendor Model
 */
export interface Vendor {
  id: string;
  name: string;
  code: string;
  lineOfBusiness: LineOfBusiness; // Partition Key
  
  // Logo and Branding
  logo?: string;
  website?: string;
  
  // RPA Integration
  rpaEnabled: boolean;
  rpaEndpoint?: string;
  rpaApiKey?: string;
  rpaConfig?: any;
  
  // Static Plans (for now)
  hasStaticPlans: boolean;
  
  // Status
  isActive: boolean;
  priority: number; // Display order
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Plan List Request DTO
 */
export interface PlanListRequest {
  leadId: string; // Required
  
  // Pagination
  page: number;
  limit: number;
  
  // Sorting
  sortBy?: 'annualPremium' | 'monthlyPremium' | 'deductible' | 'annualLimit' | 'coInsurance' | 'waitingPeriod';
  sortOrder?: 'asc' | 'desc';
  
  // Filters
  applyFilterId?: string; // Apply saved filter
  filters?: {
    vendorIds?: string[];
    isAvailable?: boolean;
    isSelected?: boolean;
    planTypes?: string[];
    annualPremium?: { min?: number; max?: number };
    monthlyPremium?: { min?: number; max?: number };
    annualLimit?: { min?: number; max?: number };
    deductible?: { min?: number; max?: number };
    coInsurance?: { min?: number; max?: number };
    waitingPeriod?: { min?: number; max?: number };
  };
}

/**
 * Plan List Response DTO
 */
export interface PlanListResponse {
  data: Plan[];
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
      vendors: Array<{ id: string; name: string; count: number; avgPremium: number }>;
      planTypes: Array<{ value: string; label: string; count: number }>;
      priceRanges: {
        minPremium: number;
        maxPremium: number;
        avgPremium: number;
      };
      coverageRanges: {
        minAnnualLimit: number;
        maxAnnualLimit: number;
        minDeductible: number;
        maxDeductible: number;
      };
    };
  };
  sort: {
    sortBy: string;
    sortOrder: string;
  };
  aggregations?: {
    totalPlans: number;
    availablePlans: number;
    selectedPlans: number;
    byVendor: Array<{ vendor: string; count: number; avgPremium: number }>;
  };
  recommendations?: {
    bestValue: string; // Plan ID
    lowestPrice: string;
    bestCoverage: string;
  };
}

/**
 * Fetch Plans Request DTO
 */
export interface FetchPlansRequest {
  leadId: string;
  lineOfBusiness: LineOfBusiness;
  businessType: string;
  leadData: any;
  forceRefresh?: boolean; // Force re-fetch even if plans exist
}

/**
 * Select Plans Request DTO
 */
export interface SelectPlansRequest {
  leadId: string;
  planIds: string[];
}


