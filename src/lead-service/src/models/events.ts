/**
 * Event Models for Lead Service
 * All events published and subscribed by Lead Service
 */

import { Lead, LineOfBusiness } from './lead';

/**
 * Base Event Interface
 */
export interface BaseEvent {
  eventType: string;
  eventId: string;
  eventTime: Date;
  subject: string;
  dataVersion: string;
}

/**
 * Events Published by Lead Service
 */

export interface LeadCreatedEvent extends BaseEvent {
  eventType: 'lead.created';
  data: {
    leadId: string;
    referenceId: string;
    customerId: string;
    lineOfBusiness: LineOfBusiness;
    businessType: string;
    formId?: string;
    formData?: any;
    lobData: any;
    assignedTo?: string;
    createdAt: Date;
  };
}

export interface LeadUpdatedEvent extends BaseEvent {
  eventType: 'lead.updated';
  data: {
    leadId: string;
    referenceId: string;
    customerId: string;
    changes: {
      field: string;
      oldValue: any;
      newValue: any;
    }[];
    updatedBy?: string;
    updatedAt: Date;
  };
}

export interface LeadStageChangedEvent extends BaseEvent {
  eventType: 'lead.stage_changed';
  data: {
    leadId: string;
    referenceId: string;
    customerId: string;
    oldStage: string;
    oldStageId: string;
    newStage: string;
    newStageId: string;
    remark?: string;
    changedBy?: string;
    timestamp: Date;
  };
}

export interface LeadAssignedEvent extends BaseEvent {
  eventType: 'lead.assigned';
  data: {
    leadId: string;
    referenceId: string;
    customerId: string;
    previousAssignee?: string;
    newAssignee: string;
    assignedBy?: string;
    timestamp: Date;
  };
}

export interface LeadDeletedEvent extends BaseEvent {
  eventType: 'lead.deleted';
  data: {
    leadId: string;
    referenceId: string;
    customerId: string;
    deletedBy?: string;
    deletedAt: Date;
  };
}

export interface LeadHotLeadMarkedEvent extends BaseEvent {
  eventType: 'lead.hot_lead_marked';
  data: {
    leadId: string;
    referenceId: string;
    customerId: string;
    markedBy?: string;
    timestamp: Date;
  };
}

/**
 * Events Subscribed by Lead Service (from other services)
 */

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

export interface QuotationCreatedEvent extends BaseEvent {
  eventType: 'quotation.created';
  data: {
    quotationId: string;
    referenceId: string;
    leadId: string;
    customerId: string;
    planCount: number;
    createdAt: Date;
  };
}

export interface QuotationGeneratedEvent extends BaseEvent {
  eventType: 'quotation.pdf_generated';
  data: {
    quotationId: string;
    referenceId: string;
    leadId: string;
    documentId: string;
    pdfUrl: string;
    generatedAt: Date;
  };
}

export interface QuotationSentEvent extends BaseEvent {
  eventType: 'quotation.sent';
  data: {
    quotationId: string;
    referenceId: string;
    leadId: string;
    customerId: string;
    email: string;
    sentAt: Date;
  };
}

export interface QuotationSubmittedForApprovalEvent extends BaseEvent {
  eventType: 'quotation.submitted_for_approval';
  data: {
    quotationId: string;
    referenceId: string;
    leadId: string;
    customerId: string;
    submittedBy: string;
    submittedAt: Date;
  };
}

export interface PolicyIssuedEvent extends BaseEvent {
  eventType: 'policy.issued';
  data: {
    policyId: string;
    policyNumber: string;
    leadId: string;
    customerId: string;
    quotationId: string;
    lineOfBusiness: string;
    issueDate: Date;
  };
}

export interface PolicyCancelledEvent extends BaseEvent {
  eventType: 'policy.cancelled';
  data: {
    policyId: string;
    policyNumber: string;
    leadId: string;
    customerId: string;
    reason: string;
    cancelledAt: Date;
  };
}

/**
 * Union types for type safety
 */
export type LeadServicePublishedEvent =
  | LeadCreatedEvent
  | LeadUpdatedEvent
  | LeadStageChangedEvent
  | LeadAssignedEvent
  | LeadDeletedEvent
  | LeadHotLeadMarkedEvent;

export type LeadServiceSubscribedEvent =
  | PlansFetchCompletedEvent
  | QuotationCreatedEvent
  | QuotationGeneratedEvent
  | QuotationSentEvent
  | QuotationSubmittedForApprovalEvent
  | PolicyIssuedEvent
  | PolicyCancelledEvent;

/**
 * Event Grid Event Wrapper
 */
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

