/**
 * Handle Customer Creation Requested Event
 * Asynchronously creates a customer from lead data
 * Implements retry logic and publishes success/failure events
 */

import { app, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { CustomerCreationRequestedEvent } from '../../types/events';
import { SignupRequest, Customer, IndividualCustomer, CompanyCustomer } from '../../types/customer';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

/**
 * Delay helper for retries
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create customer from lead data with defaults for missing fields
 */
async function createCustomerFromLeadData(
  eventData: CustomerCreationRequestedEvent['data'],
  context: InvocationContext,
  attempt: number = 1
): Promise<Customer> {
  try {
    // Determine customer type based on businessType
    const customerType = eventData.businessType === 'individual' ? 'INDIVIDUAL' : 'COMPANY';
    
    // Extract gender from lobData if available
    const gender = eventData.lobData?.gender || 'Male';
    
    const now = new Date().toISOString();
    const id = uuidv4();
    
    let customer: Customer;
    
    if (customerType === 'INDIVIDUAL') {
      // Create individual customer with defaults
      customer = {
        id,
        customerType: 'INDIVIDUAL',
        firstName: eventData.firstName,
        lastName: eventData.lastName,
        name: `${eventData.firstName} ${eventData.lastName}`,
        email: eventData.email,
        phoneNumber: eventData.phone.number,
        gender: gender,
        agent: 'system', // Default agent
        currency: 'AED', // Default currency
        customerTypeCategory: 'STANDARD', // Default category
        documentStatus: 'Pending',
        policies: [],
        contacts: [],
        creationDate: now.split('T')[0],
        firstBusinessDate: now.split('T')[0],
        createdAt: now,
        updatedAt: now,
      } as IndividualCustomer;
    } else {
      // Create company customer with defaults
      customer = {
        id,
        customerType: 'COMPANY',
        companyName: `${eventData.firstName} ${eventData.lastName}`,
        email1: eventData.email,
        phoneNumber1: eventData.phone.number,
        agent: 'system', // Default agent
        customerTypeCategory: 'STANDARD', // Default category
        currency: 'AED', // Default currency
        documentStatus: 'Pending',
        policies: [],
        contacts: [],
        creationDate: now.split('T')[0],
        firstBusinessDate: now.split('T')[0],
        createdAt: now,
        updatedAt: now,
      } as CompanyCustomer;
    }
    
    // Check if customer already exists by email
    const existingCustomer = await cosmosService.getCustomerByEmail(eventData.email);
    
    if (existingCustomer) {
      context.log(`Customer already exists with email ${eventData.email}, using existing customer ID: ${existingCustomer.id}`);
      return existingCustomer;
    }
    
    // Create new customer
    const createdCustomer = await cosmosService.createCustomer(customer);
    context.log(`✅ Customer created successfully: ${createdCustomer.id}`);
    
    return createdCustomer;
    
  } catch (error: any) {
    context.error(`❌ Failed to create customer (attempt ${attempt}/${MAX_RETRIES}):`, error.message);
    
    // Retry logic
    if (attempt < MAX_RETRIES) {
      const delayMs = RETRY_DELAYS[attempt - 1];
      context.log(`Retrying in ${delayMs}ms...`);
      await delay(delayMs);
      return createCustomerFromLeadData(eventData, context, attempt + 1);
    }
    
    // Max retries exceeded
    throw error;
  }
}

export async function handleCustomerCreationRequested(
  eventGridEvent: any,
  context: InvocationContext
): Promise<void> {
  context.log('========================================');
  context.log('CUSTOMER CREATION REQUESTED EVENT HANDLER');
  context.log('========================================');
  
  let eventData: CustomerCreationRequestedEvent['data'] | null = null;
  
  try {
    eventData = eventGridEvent.data as CustomerCreationRequestedEvent['data'];
    
    if (!eventData || !eventData.tempCustomerId || !eventData.leadId || !eventData.email) {
      context.error('Invalid CustomerCreationRequestedEvent: missing required fields');
      context.error('Event data:', JSON.stringify(eventGridEvent, null, 2));
      return;
    }
    
    context.log(`Processing customer creation for lead: ${eventData.leadId}`);
    context.log(`Temp Customer ID: ${eventData.tempCustomerId}`);
    context.log(`Email: ${eventData.email}`);
    
    // Create customer with retry logic
    const customer = await createCustomerFromLeadData(eventData, context);
    
    // Publish success event
    try {
      await eventGridService.publishCustomerCreatedFromLead({
        customerId: customer.id,
        tempCustomerId: eventData.tempCustomerId,
        leadId: eventData.leadId,
        referenceId: eventData.referenceId,
        email: eventData.email,
        createdAt: new Date()
      });
      
      context.log('✅ customer.created_from_lead event published successfully');
      
    } catch (publishError: any) {
      context.error('❌ Failed to publish customer.created_from_lead event:', publishError.message);
      context.error('Customer was created but event publication failed. Manual intervention may be required.');
      // Don't throw - customer was created successfully
    }
    
    context.log('========================================');
    context.log('CUSTOMER CREATION COMPLETED SUCCESSFULLY');
    context.log(`Real Customer ID: ${customer.id}`);
    context.log('========================================');
    
  } catch (error: any) {
    context.error('========================================');
    context.error('CUSTOMER CREATION FAILED AFTER ALL RETRIES');
    context.error('========================================');
    context.error('Error:', error.message);
    context.error('Stack:', error.stack);
    
    if (eventData) {
      context.error(`Lead ID: ${eventData.leadId}`);
      context.error(`Temp Customer ID: ${eventData.tempCustomerId}`);
      context.error(`Email: ${eventData.email}`);
      context.error('ALERT: Manual customer creation required for this lead');
    }
    
    // Don't throw - we don't want to retry the Event Grid event itself
    // The retry logic is handled within createCustomerFromLeadData
  }
}

app.eventGrid('handleCustomerCreationRequested', {
  handler: handleCustomerCreationRequested,
});
