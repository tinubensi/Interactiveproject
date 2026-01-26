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

export interface CustomerCreationRequestedEvent extends BaseEvent {
  eventType: 'customer.creation_requested';
  data: {
    tempCustomerId: string; // Temporary UUID assigned to lead
    leadId: string;
    referenceId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: {
      number: string;
      countryCode: string;
      isoCode?: string;
    };
    businessType: string; // 'individual' or 'group'
    lineOfBusiness: LineOfBusiness;
    lobData?: any; // For extracting gender or other fields
    createdAt: Date;
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

export interface CustomerCreatedFromLeadEvent extends BaseEvent {
  eventType: 'customer.created_from_lead';
  data: {
    customerId: string; // Real customer ID from customer service
    tempCustomerId: string; // Temporary UUID that was in the lead
    leadId: string;
    referenceId: string;
    email: string;
    createdAt: Date;
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
  | LeadHotLeadMarkedEvent
  | CustomerCreationRequestedEvent;

export type LeadServiceSubscribedEvent =
  | PlansFetchCompletedEvent
  | QuotationCreatedEvent
  | QuotationGeneratedEvent
  | QuotationSentEvent
  | QuotationSubmittedForApprovalEvent
  | PolicyIssuedEvent
  | PolicyCancelledEvent
  | CustomerCreatedFromLeadEvent;

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

