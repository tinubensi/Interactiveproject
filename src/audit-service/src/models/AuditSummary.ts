/**
 * Audit Summary - stored in Cosmos DB audit-summaries container
 * Partition Key: /date
 * TTL: 365 days
 */

import { AuditCategory } from './AuditLog';

/**
 * Top actor entry in summary
 */
export interface TopActor {
  userId: string;
  email: string;
  count: number;
}

/**
 * Security events summary
 */
export interface SecurityEventsSummary {
  failedLogins: number;
  permissionDenied: number;
  suspiciousActivity: number;
}

/**
 * Audit totals
 */
export interface AuditTotals {
  totalEvents: number;
  byCategory: Record<AuditCategory, number>;
  byAction: Record<string, number>;
  bySeverity: Record<string, number>;
  byEntityType: Record<string, number>;
}

/**
 * Audit Summary Document
 */
export interface AuditSummaryDocument {
  /** Document ID (UUID) */
  id: string;
  
  /** Date - Partition key (e.g., '2025-12-04') */
  date: string;
  
  /** Event totals and breakdowns */
  totals: AuditTotals;
  
  /** Top 10 most active users */
  topActors: TopActor[];
  
  /** Security event counts */
  securityEvents: SecurityEventsSummary;
  
  /** When this summary was generated */
  generatedAt: string;
  
  /** TTL in seconds for Cosmos DB auto-deletion */
  ttl: number;
}

/**
 * Stats response
 */
export interface AuditStatsResponse {
  period: 'day' | 'week' | 'month';
  startDate: string;
  endDate: string;
  totals: AuditTotals;
  topActors: TopActor[];
  securityEvents: SecurityEventsSummary;
}

