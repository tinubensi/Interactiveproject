/**
 * Audit Export - stored in Cosmos DB exports container
 * Partition Key: /exportId
 * TTL: 24 hours
 */

import { AuditCategory, AuditSeverity } from './AuditLog';

/**
 * Export format types
 */
export type ExportFormat = 'pdf' | 'csv';

/**
 * Export status
 */
export type ExportStatus = 'pending' | 'processing' | 'complete' | 'failed';

/**
 * Export filters
 */
export interface ExportFilters {
  entityType?: string;
  action?: string;
  actorId?: string;
  category?: AuditCategory;
  severity?: AuditSeverity;
}

/**
 * Export request details
 */
export interface ExportRequest {
  format: ExportFormat;
  startDate: string;
  endDate: string;
  filters: ExportFilters;
  includeDetails: boolean;
  requestedBy: string;
}

/**
 * Export result details
 */
export interface ExportResult {
  recordCount: number;
  fileSize: number;
  blobUrl: string;
  expiresAt: string;
}

/**
 * Export error details
 */
export interface ExportError {
  code: string;
  message: string;
}

/**
 * Audit Export Document
 */
export interface AuditExportDocument {
  /** Document ID (UUID) */
  id: string;
  
  /** Export ID - Partition key */
  exportId: string;
  
  /** Current status */
  status: ExportStatus;
  
  /** Export request details */
  request: ExportRequest;
  
  /** Result when complete */
  result?: ExportResult;
  
  /** Error when failed */
  error?: ExportError;
  
  /** Progress percentage (0-100) */
  progress: number;
  
  /** Created timestamp */
  createdAt: string;
  
  /** Completed timestamp */
  completedAt?: string;
  
  /** TTL in seconds for Cosmos DB auto-deletion */
  ttl: number;
}

/**
 * Request body for creating an export
 */
export interface CreateExportRequest {
  format: ExportFormat;
  startDate: string;
  endDate: string;
  filters?: ExportFilters;
  includeDetails?: boolean;
}

/**
 * Response for creating an export
 */
export interface CreateExportResponse {
  exportId: string;
  status: ExportStatus;
  estimatedRecords?: number;
  checkStatusUrl: string;
}

/**
 * Response for export status
 */
export interface ExportStatusResponse {
  exportId: string;
  status: ExportStatus;
  format?: ExportFormat;
  progress?: number;
  recordCount?: number;
  fileSize?: number;
  downloadUrl?: string;
  expiresAt?: string;
  error?: ExportError;
}

