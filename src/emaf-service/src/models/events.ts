/**
 * Event Grid Event Definitions for EMAF Service
 */

export interface EmafEventData {
  submissionId: string;
  leadId: string;
  quotationId?: string;
  vendorId?: string;
  vendorName?: string;
}

export interface EmafSubmissionCreatedEventData extends EmafEventData {
  emafTemplateId: string;
  customerId: string;
  customerEmail: string;
}

export interface EmafPdfGeneratedEventData extends EmafEventData {
  pdfUrl: string;
  pdfBlobPath: string;
}

export interface EmafSubmissionSubmittedEventData extends EmafEventData {
  submittedAt: Date;
  hasSignedPdf: boolean;
  uploadedDocumentsCount: number;
}

export interface EmafSubmissionApprovedEventData extends EmafEventData {
  approvedBy: string;
  approvedAt: Date;
  reviewNotes?: string;
}

export interface EmafSubmissionRejectedEventData extends EmafEventData {
  rejectedBy: string;
  rejectedAt: Date;
  reviewNotes: string;
}

export interface EmafRevisionRequestedEventData extends EmafEventData {
  requestedBy: string;
  requestedAt: Date;
  reviewNotes: string;
}

/**
 * Event Types
 */
export const EMAF_EVENT_TYPES = {
  SUBMISSION_CREATED: 'emaf.submission.created',
  PDF_GENERATED: 'emaf.pdf.generated',
  SUBMISSION_SUBMITTED: 'emaf.submission.submitted',
  SUBMISSION_APPROVED: 'emaf.submission.approved',
  SUBMISSION_REJECTED: 'emaf.submission.rejected',
  REVISION_REQUESTED: 'emaf.revision.requested',
} as const;

export type EmafEventType = typeof EMAF_EVENT_TYPES[keyof typeof EMAF_EVENT_TYPES];
