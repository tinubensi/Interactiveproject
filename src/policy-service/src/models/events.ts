/**
 * Event Models for Policy Service
 */

import { LineOfBusiness, PolicyRequestStatus, PolicyStatus } from './policy';

export interface BaseEvent {
  eventType: string;
  eventId: string;
  eventTime: Date;
  subject: string;
  dataVersion: string;
}

// ==================== PUBLISHED EVENTS ====================

export interface PolicyRequestCreatedEvent extends BaseEvent {
  eventType: 'policy.request_created';
  data: {
    policyRequestId: string;
    referenceId: string;
    quotationId: string;
    leadId: string;
    customerId: string;
    vendorName: string;
    lineOfBusiness: LineOfBusiness;
    createdAt: Date;
  };
}

export interface PolicyRequestApprovedEvent extends BaseEvent {
  eventType: 'policy.request_approved';
  data: {
    policyRequestId: string;
    quotationId: string;
    leadId: string;
    customerId: string;
    approvedBy: string;
    approvedAt: Date;
  };
}

export interface PolicyRequestRejectedEvent extends BaseEvent {
  eventType: 'policy.request_rejected';
  data: {
    policyRequestId: string;
    quotationId: string;
    leadId: string;
    reason: string;
    rejectedBy: string;
    rejectedAt: Date;
  };
}

export interface PolicyIssuedEvent extends BaseEvent {
  eventType: 'policy.issued';
  data: {
    policyId: string;
    policyNumber: string;
    policyRequestId: string;
    quotationId: string;
    leadId: string;
    customerId: string;
    vendorName: string;
    lineOfBusiness: LineOfBusiness;
    startDate: Date;
    endDate: Date;
    annualPremium: number;
    issuedAt: Date;
  };
}

export interface PolicyRenewedEvent extends BaseEvent {
  eventType: 'policy.renewed';
  data: {
    policyId: string;
    previousPolicyId: string;
    customerId: string;
    renewedAt: Date;
  };
}

export interface PolicyCancelledEvent extends BaseEvent {
  eventType: 'policy.cancelled';
  data: {
    policyId: string;
    customerId: string;
    reason: string;
    cancelledAt: Date;
  };
}

export interface PolicyStatusChangedEvent extends BaseEvent {
  eventType: 'policy.status_changed';
  data: {
    policyId: string;
    customerId: string;
    previousStatus: PolicyStatus;
    newStatus: PolicyStatus;
    timestamp: Date;
  };
}

// ==================== SUBSCRIBED EVENTS ====================

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

export interface QuotationPolicyIssuedEvent extends BaseEvent {
  eventType: 'quotation.policy_issued';
  data: {
    quotationId: string;
    referenceId: string;
    leadId: string;
    customerId: string;
    selectedPlanId: string;
    selectedPlanName: string;
    vendorId: string;
    vendorName: string;
    annualPremium: number;
    currency: string;
    lineOfBusiness: LineOfBusiness;
    businessType: string;
    approvedBy?: string;
    issuedAt: Date;
  };
}

export type PolicyServicePublishedEvent =
  | PolicyRequestCreatedEvent
  | PolicyRequestApprovedEvent
  | PolicyRequestRejectedEvent
  | PolicyIssuedEvent
  | PolicyRenewedEvent
  | PolicyCancelledEvent
  | PolicyStatusChangedEvent;

export type PolicyServiceSubscribedEvent = QuotationApprovedEvent | QuotationPolicyIssuedEvent;

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


