/**
 * Lead Model - Supports ALL Lines of Business
 * Designed to be LOB-agnostic with flexible data storage
 * Reference: Petli lead.js (adapted for multi-LOB support)
 */

export type LineOfBusiness = 'medical' | 'motor' | 'general' | 'marine';
export type BusinessType = 'individual' | 'group';

/**
 * Core Lead Interface - Common fields for all LOBs
 */
export interface Lead {
  // Identity
  id: string;
  referenceId: string; // Auto-generated: "LEAD-2024-0001"
  
  // Line of Business (Partition Key)
  lineOfBusiness: LineOfBusiness;
  businessType: BusinessType;
  
  // Customer Information (Common across all LOBs)
  customerId: string; // Reference to Customer Service
  firstName: string;
  lastName: string;
  fullName: string; // Computed: firstName + lastName (lowercase)
  email: string;
  phone: {
    number: string;
    countryCode: string;
    isoCode: string;
  };
  emirate: string; // Reference to emirates table
  
  // Form Reference (From Form Service)
  formId?: string; // Reference to form template used
  formData?: any; // Complete form submission (raw data)
  
  // LOB-Specific Data (Dynamic based on lineOfBusiness)
  // This is where ALL LOB-specific fields are stored
  lobData: MedicalData | MotorData | GeneralData | MarineData;
  
  // Assignment & Tracking
  assignedTo?: string; // Reference to user/agent ID
  ambassador?: any; // Ambassador details (from Petli)
  agent?: any; // Agent details (from Petli)
  source?: string; // "Website", "Referral", "Walk-in", etc.
  
  // Stage Management
  currentStage: string; // "New Lead", "Quotation Sent", etc.
  stageId: string; // Reference to stages table
  
  // Flags
  isHotLead: boolean;
  isEmailRepeated: boolean;
  isPhoneRepeated: boolean;
  isQuoteGenerated: boolean;
  isQuoteSent: boolean;
  
  // References to other services
  planFetchRequestId?: string; // Reference to PlanDB.fetchRequests
  plansCount?: number; // Number of plans fetched
  currentQuotationId?: string; // Reference to QuotationDB.quotations
  policyId?: string; // Reference to PolicyDB.policies
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date; // Soft delete
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Medical/Pet Insurance Data
 * Reference: Petli lead.js fields
 */
export interface MedicalData {
  // Individual Pet
  petName?: string;
  petType?: string; // "dog", "cat", etc. (reference to pet_types)
  petGender?: string; // reference to gender_types
  petBirthday?: string; // Date of birth
  petBreed?: string; // reference to breeds
  breedType?: string; // reference to breed_types
  isPureBreed?: boolean;
  isMicrochipped?: boolean;
  microchipId?: string;
  isNeutered?: boolean;
  hasHealthIssues?: boolean;
  healthIssuesDescription?: string;
  weightInKg?: number;
  veterinary?: string; // Vet clinic name
  
  // Group (Multiple Pets)
  numberOfPets?: number;
  pets?: Array<{
    petName: string;
    petType: string;
    petGender: string;
    petBirthday: string;
    petBreed: string;
    isPureBreed: boolean;
    isMicrochipped: boolean;
    microchipId?: string;
    isNeutered: boolean;
    hasHealthIssues: boolean;
    healthIssuesDescription?: string;
    weightInKg?: number;
  }>;
  
  // Human Medical (Future)
  // Add human medical fields here when needed
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  preExistingConditions?: string[];
}

/**
 * Motor Insurance Data
 */
export interface MotorData {
  // Individual Vehicle
  vehicleType?: string; // "sedan", "suv", "truck", "motorcycle", etc.
  make?: string; // "Toyota", "BMW", etc.
  model?: string;
  year?: number;
  plateNumber?: string;
  chassisNumber?: string;
  engineNumber?: string;
  color?: string;
  transmissionType?: string; // "automatic", "manual"
  fuelType?: string; // "petrol", "diesel", "electric", "hybrid"
  vehicleValue?: number; // AED
  seatingCapacity?: number;
  isModified?: boolean;
  modifications?: string;
  hasAccidentHistory?: boolean;
  accidentDetails?: string;
  currentInsurer?: string;
  expiryDate?: string;
  ncdPercentage?: number; // No Claims Discount
  
  // Fleet/Group
  numberOfVehicles?: number;
  vehicles?: Array<{
    vehicleType: string;
    make: string;
    model: string;
    year: number;
    plateNumber: string;
    vehicleValue: number;
    chassisNumber?: string;
  }>;
  
  // Driver Information
  driverAge?: number;
  driverNationality?: string;
  driverLicenseIssueDate?: string;
  driverLicenseType?: string;
  trafficViolations?: number;
}

/**
 * General Insurance Data (Property, Liability, etc.)
 */
export interface GeneralData {
  // Property Insurance
  propertyType?: string; // "residential", "commercial", "industrial"
  propertyValue?: number; // AED
  propertyAddress?: string;
  propertyArea?: number; // sq ft or sq m
  constructionYear?: number;
  constructionType?: string; // "concrete", "brick", "wood"
  numberOfFloors?: number;
  occupancyType?: string; // "owner-occupied", "tenant-occupied", "vacant"
  hasSecuritySystem?: boolean;
  securityFeatures?: string[]; // ["alarm", "cctv", "guard", "gate"]
  hasFireSafety?: boolean;
  fireSafetyFeatures?: string[]; // ["sprinkler", "extinguisher", "smoke-detector"]
  
  // Liability Insurance
  businessType?: string;
  businessActivity?: string;
  numberOfEmployees?: number;
  annualRevenue?: number;
  
  // Group/Multiple Properties
  numberOfProperties?: number;
  properties?: Array<{
    propertyType: string;
    propertyValue: number;
    propertyAddress: string;
    constructionYear: number;
  }>;
  
  // Claims History
  hasClaimsHistory?: boolean;
  claimsDetails?: string;
}

/**
 * Marine Insurance Data (Cargo, Hull, Yacht, etc.)
 */
export interface MarineData {
  // Cargo Insurance
  cargoType?: string; // "general", "perishable", "hazardous", "bulk"
  cargoValue?: number; // USD or AED
  cargoDescription?: string;
  origin?: string;
  destination?: string;
  transitMode?: string; // "sea", "air", "land", "multimodal"
  voyageType?: string; // "import", "export", "coastal"
  packagingType?: string;
  numberOfPackages?: number;
  
  // Hull Insurance (Vessel)
  vesselType?: string; // "cargo-ship", "tanker", "yacht", "fishing-vessel"
  vesselName?: string;
  vesselFlag?: string; // Country of registration
  imoNumber?: string;
  vesselValue?: number;
  vesselAge?: number;
  vesselLength?: number;
  vesselGrossTonnage?: number;
  engineType?: string;
  enginePower?: number;
  navigationArea?: string; // "coastal", "international", "inland"
  hasCrewInsurance?: boolean;
  crewSize?: number;
  
  // Yacht Insurance
  yachtType?: string; // "motor", "sailing"
  yachtMake?: string;
  yachtModel?: string;
  yachtYear?: number;
  yachtValue?: number;
  yachtLength?: number;
  mooringLocation?: string;
  usageType?: string; // "private", "charter", "commercial"
  
  // Claims History
  hasClaimsHistory?: boolean;
  claimsDetails?: string;
}

/**
 * Timeline Entry
 * Tracks all stage changes and important events
 */
export interface Timeline {
  id: string;
  leadId: string; // Partition Key
  stage: string;
  previousStage?: string;
  stageId: string;
  remark?: string;
  changedBy: string; // User ID
  changedByName: string; // User display name
  quotationId?: string; // If stage change related to quotation
  policyId?: string; // If stage change related to policy
  timestamp: Date;
}

/**
 * Stage Definition
 * Defines workflow stages applicable to LOBs
 */
export interface Stage {
  id: string;
  name: string;
  order: number; // Display order
  applicableFor: LineOfBusiness[]; // Which LOBs use this stage
  isActive: boolean;
}

/**
 * Create Lead Request DTO
 */
export interface CreateLeadRequest {
  // Common fields
  lineOfBusiness: LineOfBusiness;
  businessType: BusinessType;
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: {
    number: string;
    countryCode: string;
    isoCode: string;
  };
  emirate: string;
  
  // Optional
  formId?: string;
  formData?: any;
  lobData: any; // Dynamic based on LOB
  assignedTo?: string;
  ambassador?: any;
  agent?: any;
  source?: string;
}

/**
 * Update Lead Request DTO
 */
export interface UpdateLeadRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: {
    number: string;
    countryCode: string;
    isoCode: string;
  };
  emirate?: string;
  lobData?: any; // Partial update of LOB data
  assignedTo?: string;
  ambassador?: any;
  agent?: any;
  source?: string;
  isHotLead?: boolean;
}

/**
 * Lead List Request DTO (for advanced search/filter)
 */
export interface LeadListRequest {
  // Pagination
  page: number;
  limit: number;
  
  // Sorting
  sortBy?: 'createdAt' | 'updatedAt' | 'firstName' | 'currentStage' | 'referenceId';
  sortOrder?: 'asc' | 'desc';
  
  // Global Search
  search?: string; // Searches: firstName, lastName, email, phone, referenceId
  
  // Filters
  filters?: {
    lineOfBusiness?: LineOfBusiness[];
    businessType?: BusinessType[];
    stageId?: number[];
    currentStage?: string[];
    assignedTo?: string[];
    ambassador?: string[];
    agent?: string[];
    source?: string[];
    isHotLead?: boolean;
    isEmailRepeated?: boolean;
    isPhoneRepeated?: boolean;
    customerId?: string;
    emirate?: string[];
    createdFrom?: string;
    createdTo?: string;
    updatedFrom?: string;
    updatedTo?: string;
    
    // LOB-specific filters (dynamic)
    lobFilters?: any;
  };
  
  // Advanced
  includeDeleted?: boolean;
  fieldsToReturn?: string[];
}

/**
 * Lead List Response DTO
 */
export interface LeadListResponse {
  data: Lead[];
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
      lineOfBusiness: Array<{ value: string; label: string; count: number }>;
      stages: Array<{ id: number; name: string; count: number }>;
      emirates: string[];
      sources: string[];
      assignedAgents: Array<{ id: string; name: string; count: number }>;
    };
  };
  sort: {
    sortBy: string;
    sortOrder: string;
  };
  aggregations?: {
    totalLeads: number;
    byStage: Array<{ stage: string; count: number }>;
    byLOB: Array<{ lob: string; count: number }>;
    bySource: Array<{ source: string; count: number }>;
    hotLeadsCount: number;
  };
}

/**
 * Helper type guards
 */
export function isMedicalData(lobData: any): lobData is MedicalData {
  return 'petName' in lobData || 'dateOfBirth' in lobData;
}

export function isMotorData(lobData: any): lobData is MotorData {
  return 'vehicleType' in lobData || 'make' in lobData;
}

export function isGeneralData(lobData: any): lobData is GeneralData {
  return 'propertyType' in lobData || 'businessType' in lobData;
}

export function isMarineData(lobData: any): lobData is MarineData {
  return 'cargoType' in lobData || 'vesselType' in lobData || 'yachtType' in lobData;
}

