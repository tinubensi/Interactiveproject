/**
 * Event Models for Customer Service
 * All events published and subscribed by Customer Service
 */

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
 * Events Subscribed by Customer Service (from other services)
 */

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
    lineOfBusiness: string;
    lobData?: any; // For extracting gender or other fields
    createdAt: Date;
  };
}

/**
 * Events Published by Customer Service
 */

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

export interface CustomerCreatedEvent extends BaseEvent {
  eventType: 'customer.created';
  data: {
    customerId: string;
    customerType: 'INDIVIDUAL' | 'COMPANY';
    email?: string;
    email1?: string;
    name?: string;
    companyName?: string;
    createdAt: Date;
  };
}

/**
 * Union types for type safety
 */
export type CustomerServicePublishedEvent =
  | CustomerCreatedFromLeadEvent
  | CustomerCreatedEvent;

export type CustomerServiceSubscribedEvent =
  | CustomerCreationRequestedEvent;

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
