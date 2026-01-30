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
  questionId: string;
  questionDataKey: string;
  questionLabel: string;
  mappingType?: 'text-overlay' | 'form-field';
  pdfPageNumber: number;
  x: number;
  y: number;
  fontSize?: number;
  fontColor?: string;
  maxWidth?: number;
  alignment?: 'left' | 'center' | 'right';
  fontFamily?: 'Helvetica' | 'Helvetica-Bold' | 'Times-Roman' | 'Courier';
  formFieldName?: string;
  formFieldValueMap?: Record<string, string>;
}

/**
 * EMAF Template
 * Defines the structure of the medical application form for each vendor
 */
export interface EmafTemplate {
  id: string;
  emafId: string;
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  lineOfBusiness: string;
  name: string;
  description?: string;
  sections: FormSection[];
  requiredDocuments: DocumentRequirement[];
  templateType?: 'html' | 'coordinate-overlay';
  htmlTemplatePath?: string;
  templateVersion?: string;
  templateUpdatedAt?: Date;
  templateUpdatedBy?: string;
  vendorPdfBlobPath?: string;
  vendorPdfSasUrl?: string;
  vendorPdfUploadedAt?: Date;
  vendorPdfFileName?: string;
  vendorPdfPageCount?: number;
  pdfFieldMappings?: PdfFieldMapping[];
  mappingConfiguredAt?: Date;
  mappingConfiguredBy?: string;
  mappingVersion?: number;
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
  documentType: string;
  label: string;
  description?: string;
  required: boolean;
  acceptedFormats: string[];
  maxSizeInMB: number;
}

/**
 * EMAF Submission
 * Customer's filled EMAF form data and associated documents
 */
export interface EmafSubmission {
  id: string;
  submissionId: string;
  leadId: string;
  quotationId: string;
  selectedPlanId: string;
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  emafTemplateId: string;
  emafVersion: number;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  formData: Record<string, any>;
  uploadedDocuments: UploadedDocument[];
  pdfGenerationJobId?: string;
  generatedPdfBlobPath?: string;
  generatedPdfSasUrl?: string;
  pdfGeneratedAt?: Date;
  pdfDownloadedAt?: Date;
  signedPdfBlobPath?: string;
  signedPdfSasUrl?: string;
  signedPdfUploadedAt?: Date;
  status: EmafSubmissionStatus;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
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
