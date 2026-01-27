/**
 * Event Models for Quotation Service
 */

import { LineOfBusiness, QuotationStatus } from './quotation';

export interface BaseEvent {
  eventType: string;
  eventId: string;
  eventTime: Date;
  subject: string;
  dataVersion: string;
}

// ==================== PUBLISHED EVENTS ====================

export interface QuotationCreatedEvent extends BaseEvent {
  eventType: 'quotation.created';
  data: {
    quotationId: string;
    referenceId: string;
    leadId: string;
    customerId: string;
    lineOfBusiness: LineOfBusiness;
    totalPremium: number;
    planCount: number;
    version: number;
    createdAt: Date;
  };
}

export interface QuotationUpdatedEvent extends BaseEvent {
  eventType: 'quotation.updated';
  data: {
    quotationId: string;
    leadId: string;
    updatedFields: string[];
    updatedBy?: string;
    timestamp: Date;
  };
}

export interface QuotationRevisedEvent extends BaseEvent {
  eventType: 'quotation.revised';
  data: {
    quotationId: string; // New quotation ID
    previousQuotationId: string;
    leadId: string;
    version: number;
    reason: string;
    plansChanged: boolean;
    timestamp: Date;
  };
}

export interface QuotationSentEvent extends BaseEvent {
  eventType: 'quotation.sent';
  data: {
    quotationId: string;
    leadId: string;
    recipientEmail: string;
    pdfUrl?: string;
    sentAt: Date;
  };
}

export interface QuotationApprovedEvent extends BaseEvent {
  eventType: 'quotation.approved';
  data: {
    quotationId: string;
    leadId: string;
    customerId: string;
    selectedPlanId: string;
    approvedAt: Date;
  };
}

export interface QuotationRejectedEvent extends BaseEvent {
  eventType: 'quotation.rejected';
  data: {
    quotationId: string;
    leadId: string;
    reason?: string;
    rejectedAt: Date;
  };
}

export interface QuotationExpiredEvent extends BaseEvent {
  eventType: 'quotation.expired';
  data: {
    quotationId: string;
    leadId: string;
    validUntil: Date;
    expiredAt: Date;
  };
}

export interface QuotationStatusChangedEvent extends BaseEvent {
  eventType: 'quotation.status_changed';
  data: {
    quotationId: string;
    leadId: string;
    previousStatus: QuotationStatus;
    newStatus: QuotationStatus;
    reason?: string;
    timestamp: Date;
  };
}

// ==================== SUBSCRIBED EVENTS ====================

export interface PlansSelectedEvent extends BaseEvent {
  eventType: 'plans.selected';
  data: {
    leadId: string;
    planIds: string[];
    selectedBy?: string;
    timestamp: Date;
  };
}

export type QuotationServicePublishedEvent =
  | QuotationCreatedEvent
  | QuotationUpdatedEvent
  | QuotationRevisedEvent
  | QuotationSentEvent
  | QuotationApprovedEvent
  | QuotationRejectedEvent
  | QuotationExpiredEvent
  | QuotationStatusChangedEvent;

export type QuotationServiceSubscribedEvent = PlansSelectedEvent;

export interface EventGridEvent<T = any> {
  id: string;
  eventType: string;
  subject: string;
  eventTime: string;
  data: T;
  dataVersion: string;
  metadataVersion?: string;
  topic?: string;
}


