/**
 * Document model representing the Cosmos DB schema
 */
export enum DocumentType {
  Passport = 'Passport',
  EmiratesID = 'EmiratesID',
  TradeLicense = 'TradeLicense',
  PolicyWording = 'PolicyWording',
  KnowledgeBase = 'KnowledgeBase',
}

export interface Document {
  id: string; // documentId
  customerId: string; // partition key
  userId: string; // user who uploaded the document
  documentType: DocumentType;
  fileName: string;
  blobPath: string;
  expiryDate: string; // ISO-8601 datetime
  ttl: number; // computed from expiryDate, in seconds
  uploaded: boolean; // false until client uploads the file
  createdAt: string; // ISO-8601 datetime
}

export interface CreateDocumentRequest {
  userId: string; // user uploading the document
  documentType: DocumentType;
  fileName: string;
  expiryDate: string; // ISO-8601 date string
}

export interface CreateDocumentResponse {
  documentId: string;
  uploadSasUri: string;
  blobPath: string;
}

export interface ListDocumentResponse {
  id: string;
  userId: string;
  documentType: string;
  fileName: string;
  expiryDate: string;
  uploaded: boolean;
}

export interface DownloadDocumentResponse {
  downloadSasUri: string;
}

export interface ConfirmUploadRequest {
  uploaded: boolean;
}

