/**
 * Event models for Event Grid publishing
 */

export interface CustomerDocumentUploadedEvent {
  documentId: string;
  customerId: string;
  documentType: string;
  blobPath: string;
  leadId?: string; // Optional: For pipeline integration
}

export interface CustomerDocumentExpiredEvent {
  documentId: string;
  customerId: string;
  documentType: string;
}

/**
 * Pipeline-specific document uploaded event
 * Published when a document is uploaded for a lead
 */
export interface PipelineDocumentUploadedEvent {
  documentId: string;
  leadId: string;
  customerId: string;
  documentType: string;
  uploadedAt: string;
}

export enum EventType {
  DocumentUploaded = 'CustomerDocumentUploaded',
  DocumentExpired = 'CustomerDocumentExpired',
  // Pipeline event type
  PipelineDocumentUploaded = 'document.uploaded',
}

