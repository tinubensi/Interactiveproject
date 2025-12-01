/**
 * Event models for Event Grid publishing
 */

export interface CustomerDocumentUploadedEvent {
  documentId: string;
  customerId: string;
  documentType: string;
  blobPath: string;
}

export interface CustomerDocumentExpiredEvent {
  documentId: string;
  customerId: string;
  documentType: string;
}

export enum EventType {
  DocumentUploaded = 'CustomerDocumentUploaded',
  DocumentExpired = 'CustomerDocumentExpired',
}

