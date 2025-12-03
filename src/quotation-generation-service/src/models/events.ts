/**
 * Event Models for Quotation Generation Service
 */

import { LineOfBusiness } from './plan';

export interface BaseEvent {
  eventType: string;
  eventId: string;
  eventTime: Date;
  subject: string;
  dataVersion: string;
}

// ==================== PUBLISHED EVENTS ====================

export interface PlansFetchStartedEvent extends BaseEvent {
  eventType: 'plans.fetch_started';
  data: {
    leadId: string;
    fetchRequestId: string;
    lineOfBusiness: LineOfBusiness;
    vendorCount: number;
    timestamp: Date;
  };
}

export interface PlansFetchCompletedEvent extends BaseEvent {
  eventType: 'plans.fetch_completed';
  data: {
    leadId: string;
    fetchRequestId: string;
    totalPlans: number;
    successfulVendors: string[];
    failedVendors: string[];
    timestamp: Date;
  };
}

export interface PlansFetchFailedEvent extends BaseEvent {
  eventType: 'plans.fetch_failed';
  data: {
    leadId: string;
    fetchRequestId: string;
    error: string;
    timestamp: Date;
  };
}

export interface PlansFilteredEvent extends BaseEvent {
  eventType: 'plans.filtered';
  data: {
    leadId: string;
    filterCriteria: any;
    resultCount: number;
    timestamp: Date;
  };
}

export interface PlansComparedEvent extends BaseEvent {
  eventType: 'plans.compared';
  data: {
    leadId: string;
    comparisonId: string;
    planIds: string[];
    timestamp: Date;
  };
}

export interface PlansSelectedEvent extends BaseEvent {
  eventType: 'plans.selected';
  data: {
    leadId: string;
    planIds: string[];
    selectedBy?: string;
    timestamp: Date;
  };
}

// ==================== SUBSCRIBED EVENTS ====================

export interface LeadCreatedEvent extends BaseEvent {
  eventType: 'lead.created';
  data: {
    leadId: string;
    referenceId: string;
    customerId: string;
    lineOfBusiness: LineOfBusiness;
    businessType: string;
    formData?: any;
    lobData: any;
    createdAt: Date;
  };
}

export type QuotationGenerationServicePublishedEvent =
  | PlansFetchStartedEvent
  | PlansFetchCompletedEvent
  | PlansFetchFailedEvent
  | PlansFilteredEvent
  | PlansComparedEvent
  | PlansSelectedEvent;

export type QuotationGenerationServiceSubscribedEvent = LeadCreatedEvent;

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


