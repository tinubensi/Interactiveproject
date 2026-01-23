/**
 * EMAF (Electronic Medical Application Form) Types
 * Core type definitions for EMAF templates and submissions
 */

// Form builder types (copied from form-service for microservice independence)
export type QuestionType =
  | 'text'
  | 'number'
  | 'currency'
  | 'date'
  | 'dropdown'
  | 'radio'
  | 'checkbox'
  | 'email'
  | 'phone';

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  enum?: string[];
  message?: string;
}

export interface FormQuestion {
  id: string;
  label: string;
  dataKey: string;
  type: QuestionType;
  order: number;
  placeholder?: string;
  helperText?: string;
  options?: Array<{ label: string; value: string }>;
  validation?: ValidationRule;
}

export interface FormSection {
  id: string;
  title: string;
  order: number;
  questions: FormQuestion[];
}

export type EmafStatus = 'draft' | 'published' | 'archived';

export type EmafSubmissionStatus = 
  | 'draft'
  | 'form_completed'
  | 'pdf_generated'
  | 'pdf_downloaded'
  | 'pending_signature'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'revision_required';

/**
 * PDF Field Mapping
 * Maps a form question to specific coordinates on the vendor PDF OR to PDF form fields
 */
export interface PdfFieldMapping {
  id: string;
  questionId: string; // FormQuestion.id
  questionDataKey: string; // FormQuestion.dataKey for easy lookup
  questionLabel: string; // For display purposes
  
  // Mapping type: text overlay (default) or form field
  mappingType?: 'text-overlay' | 'form-field'; // Default: 'text-overlay'
  
  // Text overlay fields (for drawing text on PDF)
  pdfPageNumber: number; // 1-indexed page number
  x: number; // X coordinate in PDF points (1 point = 1/72 inch)
  y: number; // Y coordinate in PDF points (measured from bottom-left)
  fontSize?: number; // Default: 11
  fontColor?: string; // Hex color, default: '#000000'
  maxWidth?: number; // Max width for text wrapping in points
  alignment?: 'left' | 'center' | 'right'; // Default: 'left'
  fontFamily?: 'Helvetica' | 'Helvetica-Bold' | 'Times-Roman' | 'Courier'; // Default: 'Helvetica'
  
  // Form field mapping (for checking checkboxes, filling text fields)
  formFieldName?: string; // PDF form field name (e.g., "Check Box67")
  formFieldValueMap?: Record<string, string>; // Map answer values to field names
  // Example: { "yes": "Check Box67", "no": "Check Box68" }
  // For radio buttons with Yes/No, this maps which checkbox to check based on answer
}

/**
 * EMAF Template
 * Defines the structure of the medical application form for each vendor
 */
export interface EmafTemplate {
  id: string;
  emafId: string;
  vendorId: string; // Partition key
  vendorCode: string;
  vendorName: string;
  lineOfBusiness: string;
  
  // Form structure (reuse from form-service)
  name: string;
  description?: string;
  sections: FormSection[];
  
  // Document requirements
  requiredDocuments: DocumentRequirement[];
  
  // PDF Generation Approach (defaults to 'coordinate-overlay' for backward compatibility)
  templateType?: 'html' | 'coordinate-overlay'; // 'html' for new approach, 'coordinate-overlay' for legacy
  
  // HTML Template Configuration (NEW APPROACH)
  htmlTemplatePath?: string; // Path to HTML template file (e.g., 'vendors/alsagr-emaf.hbs')
  templateVersion?: string; // Template version (e.g., 'v1.0.0')
  templateUpdatedAt?: Date;
  templateUpdatedBy?: string;
  
  // Vendor PDF template configuration (for reference or legacy)
  vendorPdfBlobPath?: string; // Path to vendor's original PDF in blob storage
  vendorPdfSasUrl?: string; // SAS URL for downloading vendor PDF (valid for 1 year)
  vendorPdfUploadedAt?: Date;
  vendorPdfFileName?: string;
  vendorPdfPageCount?: number; // Number of pages in vendor PDF
  
  // Field mappings for PDF overlay (LEGACY - kept for backward compatibility)
  pdfFieldMappings?: PdfFieldMapping[]; // Coordinates where form data should be overlaid
  
  // Mapping configuration metadata (LEGACY)
  mappingConfiguredAt?: Date;
  mappingConfiguredBy?: string;
  mappingVersion?: number; // Track mapping changes
  
  // Metadata
  status: EmafStatus;
  version: number;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  isDeleted?: boolean;
  publishedAt?: Date;
  publishedBy?: string;
}

/**
 * Document Requirement
 * Defines what documents must be uploaded with the EMAF
 */
export interface DocumentRequirement {
  id: string;
  documentType: string; // 'passport', 'emirates_id', 'visa', 'medical_history', etc.
  label: string;
  description?: string;
  required: boolean;
  acceptedFormats: string[]; // ['pdf', 'jpg', 'png']
  maxSizeInMB: number;
}

/**
 * EMAF Submission
 * Customer's filled EMAF form data and associated documents
 */
export interface EmafSubmission {
  id: string;
  submissionId: string;
  leadId: string; // Partition key
  quotationId: string;
  selectedPlanId: string;
  
  // Vendor from RPA plan
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  
  // EMAF template reference
  emafTemplateId: string;
  emafVersion: number;
  
  // Customer info
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  
  // Form data
  formData: Record<string, any>;
  
  // Document uploads
  uploadedDocuments: UploadedDocument[];
  
  // PDF tracking
  pdfGenerationJobId?: string;
  generatedPdfBlobPath?: string;
  generatedPdfSasUrl?: string;
  pdfGeneratedAt?: Date;
  pdfDownloadedAt?: Date;
  signedPdfBlobPath?: string;
  signedPdfSasUrl?: string;
  signedPdfUploadedAt?: Date;
  
  // Workflow
  status: EmafSubmissionStatus;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Uploaded Document
 * Represents a document uploaded as part of EMAF submission
 */
export interface UploadedDocument {
  id: string;
  documentRequirementId: string;
  documentType: string;
  fileName: string;
  blobPath: string;
  sasUrl: string;
  uploadedAt: Date;
  fileSize: number;
  mimeType: string;
}

/**
 * PDF Generation Job
 * Tracks the status of async PDF generation
 */
export interface PdfGenerationJob {
  id: string;
  jobId: string;
  submissionId: string;
  leadId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  errorMessage?: string;
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Request/Response Types
 */

export interface CreateEmafTemplateRequest {
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  lineOfBusiness: string;
  name: string;
  description?: string;
  sections: FormSection[];
  requiredDocuments: DocumentRequirement[];
}

export interface UpdateEmafTemplateRequest {
  name?: string;
  description?: string;
  sections?: FormSection[];
  requiredDocuments?: DocumentRequirement[];
  status?: EmafStatus;
  vendorPdfBlobPath?: string;
  vendorPdfSasUrl?: string;
  vendorPdfUploadedAt?: Date;
  vendorPdfFileName?: string;
  vendorPdfPageCount?: number;
  pdfFieldMappings?: PdfFieldMapping[];
  mappingConfiguredAt?: Date;
  mappingConfiguredBy?: string;
  mappingVersion?: number;
}

export interface UploadVendorPdfRequest {
  templateId: string;
  vendorId: string;
  // File will be in form data
}

export interface UpdateFieldMappingsRequest {
  pdfFieldMappings: PdfFieldMapping[];
}

export interface ExtractQuestionsRequest {
  // PDF file will be in form data
  lineOfBusiness?: string;
}

export interface ExtractQuestionsResponse {
  success: boolean;
  sections?: FormSection[];
  documentRequirements?: DocumentRequirement[];
  pageCount?: number;
  error?: string;
}

export interface CreateSubmissionRequest {
  leadId: string;
  quotationId: string;
  selectedPlanId: string;
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export interface SaveEmafDataRequest {
  formData: Record<string, any>;
  leadId: string;
}

export interface ApproveSubmissionRequest {
  reviewNotes?: string;
  approvedBy: string;
}

export interface RejectSubmissionRequest {
  reviewNotes: string;
  rejectedBy: string;
}

export interface RequestRevisionRequest {
  reviewNotes: string;
  requestedBy: string;
}
