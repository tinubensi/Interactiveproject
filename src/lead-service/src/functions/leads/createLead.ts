/**
 * Create Lead Function
 * Creates a new insurance lead for any line of business
 * Reference: Petli createLead controller and service
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { generateLeadReferenceId } from '../../utils/referenceGenerator';
import { validateCreateLeadRequest, sanitizeInput } from '../../utils/validation';
import { Lead, CreateLeadRequest } from '../../models/lead';
import { handlePreflight, withCors } from '../../utils/corsHelper';
import { ensureAuthorized, requirePermission, LEAD_PERMISSIONS } from '../../lib/auth';
import { isLeadManagedByPipeline, notifyLeadCreated } from '../../services/pipelineServiceClient';
import { customerServiceClient, SignupRequest } from '../../services/customerServiceClient';
import axios from 'axios';

/**
 * Helper function to create customer from lead data
 */
async function createCustomerFromLead(
  leadData: CreateLeadRequest,
  leadId: string,
  context: InvocationContext
): Promise<string> {
  try {
    // Determine customer type based on businessType
    const customerType = leadData.businessType === 'individual' ? 'INDIVIDUAL' : 'COMPANY';
    
    // Extract gender from lobData if available
    const gender = leadData.lobData?.gender || 'Male';
    
    // Prepare customer data
    const customerData: SignupRequest = {
      customerType,
      agent: 'default-agent',
      currency: 'AED',
    };
    
    if (customerType === 'INDIVIDUAL') {
      customerData.firstName = leadData.firstName;
      customerData.lastName = leadData.lastName;
      customerData.name = `${leadData.firstName} ${leadData.lastName}`;
      customerData.email = leadData.email;
      customerData.phoneNumber = leadData.phone.number;
      customerData.gender = gender;
    } else {
      // For group/company
      customerData.companyName = `${leadData.firstName} ${leadData.lastName}`;
      customerData.email1 = leadData.email;
      customerData.phoneNumber1 = leadData.phone.number;
    }
    
    context.log('Creating new customer:', { customerType, email: leadData.email });
    
    const customer = await customerServiceClient.createCustomer(customerData);
    
    context.log(`✅ Customer created successfully: ${customer.id}`);
    return customer.id;
    
  } catch (error: any) {
    context.error('❌ Failed to create customer in Customer Service:', error.message);
    context.error('Falling back to temporary customer ID');
    
    // Fallback to temporary customer ID if creation fails
    return `customer-${leadId}`;
  }
}

export async function createLead(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, LEAD_PERMISSIONS.LEADS_CREATE);
    // Parse request body, handle empty or invalid JSON
    let body: CreateLeadRequest;
    try {
      const requestBody = await request.text();
      if (!requestBody) {
        return withCors(request, {
          status: 400,
          jsonBody: {
            success: false,
            error: 'Request body is required'
          }
        });
      }
      body = JSON.parse(requestBody) as CreateLeadRequest;
    } catch (parseError: any) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Invalid JSON in request body',
          details: parseError.message
        }
      });
    }

    // Validate request
    // TEMPORARILY DISABLED FOR TESTING
    /*
    const validation = validateCreateLeadRequest(body);
    if (!validation.valid) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          error: 'Validation failed',
          details: validation.errors
        }
      });
    }
    */

    // Check for repeated email/phone
    const { isEmailRepeated, isPhoneRepeated } = await cosmosService.checkRepeatedContact(
      body.email,
      body.phone.number
    );

    // Sanitize names (lowercase for storage)
    const firstName = sanitizeInput(body.firstName);
    const lastName = sanitizeInput(body.lastName);
    const fullName = `${firstName} ${lastName}`;

    // Generate reference ID
    const referenceId = await generateLeadReferenceId();

    // Determine assignee (from Petli logic)
    let assignedTo = body.assignedTo;

    // If no assignee or assignee is ambassador, assign to technical user
    // TODO: Integrate with Customer Service to fetch technical user
    if (!assignedTo) {
      // For now, use a placeholder
      assignedTo = 'technical-default';
    }

    // Generate lead ID
    const leadId = uuidv4();
    
    // Handle customer ID: use provided, check existing, or create new
    let customerId = body.customerId;
    let customerAutoCreated = false;
    let customerLinkedByEmail = false;
    
    if (!customerId) {
      context.log('No customerId provided, checking if customer exists by email...');
      
      try {
        // Check if customer already exists by email
        const existingCustomer = await customerServiceClient.checkCustomerByEmail(body.email);
        
        if (existingCustomer) {
          // Customer found - link to existing customer
          customerId = existingCustomer.id;
          customerLinkedByEmail = true;
          context.log(`✅ Customer found by email: ${customerId}`);
        } else {
          // Customer not found - create new customer
          context.log('Customer not found, creating new customer...');
          customerId = await createCustomerFromLead(body, leadId, context);
          customerAutoCreated = true;
        }
      } catch (error: any) {
        context.error('Error during customer check/creation:', error.message);
        // Fallback to temporary customer ID
        customerId = `customer-${leadId}`;
        context.log(`⚠️ Using fallback customer ID: ${customerId}`);
      }
    } else {
      context.log(`Using provided customerId: ${customerId}`);
    }

    // CRITICAL: Clean formData to remove duplicate keys with different casings
    // Frontend sends polluted formData with firstName, firstname, Firstname, FIRSTNAME, etc.
    // This cleaning MUST happen even if frontend cleaned it, as a safety layer
    const canonicalFields = [
      'firstName', 'lastName', 'email', 'phone', 'emirate',
      'nationality', 'effectiveDate', 'visaLocation', 'occupation', 
      'homeCountry', 'dateOfBirth', 'gender', 'emiratesId',
      'monthlySalaryRange', 'salaryRange', 'visaType', 'maritalStatus',
      'passportNumber', 'visaFileNumber', 'visaExpiryDate',
      'residentialLocation', 'countryOfResidence', 'currentlyInsured',
      '_fieldLabels', '_sectionLabels', 'title', 'relation'
    ];
    
    // Clean formData - only keep canonical fields
    const cleanFormDataForStorage = (() => {
      const cleaned: any = {};
      
      if (body.formData && typeof body.formData === 'object') {
        Object.keys(body.formData).forEach(key => {
          // Keep ONLY canonical fields (exact match) and special prefixes
          // This filters out all variations like "firstname", "Firstname", "FIRSTNAME", "first name", etc.
          if (canonicalFields.includes(key) || 
              key.startsWith('lobData.') || 
              key.startsWith('section-') ||
              key.startsWith('_')) {
            cleaned[key] = body.formData[key];
          }
        });
      }
      
      return cleaned;
    })();
    
    // Clean lobData - extract ONLY LOB-specific fields (not common fields like firstName, lastName, etc.)
    const cleanLobDataForStorage = (() => {
      // LOB-specific fields only (exclude common customer fields)
      const lobSpecificFields = [
        'dateOfBirth', 'gender', 'emiratesId', 'monthlySalaryRange', 'salaryRange',
        'visaType', 'maritalStatus', 'passportNumber', 'visaFileNumber',
        'visaExpiryDate', 'visaLocation', 'occupation', 'homeCountry',
        'nationality', 'residentialLocation', 'countryOfResidence', 'currentlyInsured'
      ];
      
      const cleaned: any = {};
      
      if (body.lobData && typeof body.lobData === 'object') {
        Object.keys(body.lobData).forEach(key => {
          // Only include LOB-specific fields (exclude firstName, lastName, email, phone, emirate)
          if (lobSpecificFields.includes(key) && 
              typeof body.lobData[key] !== 'object' &&
              body.lobData[key] !== null) {
            cleaned[key] = body.lobData[key];
          }
        });
      }
      
      return cleaned;
    })();

    // Create lead object
    const lead: any = {
      type: 'lead', // Required for Cosmos DB queries
      id: leadId,
      referenceId,
      lineOfBusiness: body.lineOfBusiness,
      businessType: body.businessType,
      customerId: customerId,
      firstName,
      lastName,
      fullName,
      email: body.email,
      phone: body.phone,
      emirate: body.emirate,
      formId: body.formId,
      formData: cleanFormDataForStorage, // Use cleaned formData, not polluted one
      lobData: cleanLobDataForStorage, // Use cleaned lobData (only LOB-specific fields, no common fields)
      assignedTo,
      ambassador: body.ambassador,
      agent: body.agent,
      source: body.source || 'Website',
      currentStage: 'Lead Created', // Start at Lead Created stage - Pipeline Service will handle progression
      stageId: 'stage-0', // stage-0 = Lead Created
      isHotLead: false,
      isEmailRepeated,
      isPhoneRepeated,
      isQuoteGenerated: false,
      isQuoteSent: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save to Cosmos DB
    const createdLead = await cosmosService.createLead(lead);

    // Create initial timeline entry
    await cosmosService.createTimelineEntry({
      id: uuidv4(),
      leadId: createdLead.id,
      stage: 'Lead Created', // Initial stage is Lead Created - Pipeline Service will handle progression
      stageId: 'stage-0', // stage-0 = Lead Created
      remark: 'Lead created successfully',
      changedBy: body.assignedTo || 'system',
      changedByName: 'System',
      timestamp: new Date()
    });

    // Publish lead.created event to Event Grid (primary communication method)
    let eventPublished = false;
    let httpFallbackTriggered = false;
    
    // CRITICAL: Ensure formData is clean before sending to Event Grid
    // Even though we cleaned it before saving, ensure it's clean here too
    const cleanFormDataForEventGrid = createdLead.formData || cleanFormDataForStorage;
    
    try {
      await eventGridService.publishLeadCreated({
        leadId: createdLead.id,
        referenceId: createdLead.referenceId,
        customerId: createdLead.customerId,
        lineOfBusiness: createdLead.lineOfBusiness,
        businessType: createdLead.businessType,
        formId: createdLead.formId,
        formData: cleanFormDataForEventGrid, // Use cleaned formData, not polluted one
        lobData: createdLead.lobData,
        assignedTo: createdLead.assignedTo,
        createdAt: createdLead.createdAt,
        // 🔧 ADD CONTACT FIELDS FOR RPA BOTS
        firstName: createdLead.firstName,
        lastName: createdLead.lastName,
        email: createdLead.email,
        phone: createdLead.phone,
        emirate: createdLead.emirate
      });
      eventPublished = true;
      context.log('✅ lead.created event published successfully to Event Grid');
      
    } catch (eventError: any) {
      context.error('❌ Failed to publish lead.created event to Event Grid:', eventError.message);
      context.error('Stack:', eventError.stack);
      
      // HTTP FALLBACK: Directly call Pipeline Service
      const PIPELINE_SERVICE_URL = process.env.PIPELINE_SERVICE_URL || 'https://func-nectaria-pipeline-dev.azurewebsites.net';
      const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || 'dev-internal-service-key-nectaria-2024';
      
      try {
        context.log(`[HTTP FALLBACK] Calling Pipeline Service directly at ${PIPELINE_SERVICE_URL}`);
        
        const fallbackResponse = await axios.post(
          `${PIPELINE_SERVICE_URL}/api/pipeline/process-event`,
          {
            eventType: 'lead.created',
            subject: `leads/${createdLead.id}`,
            data: {
              leadId: createdLead.id,
              referenceId: createdLead.referenceId,
              customerId: createdLead.customerId,
              lineOfBusiness: createdLead.lineOfBusiness,
              businessType: createdLead.businessType,
              formId: createdLead.formId,
              formData: cleanFormDataForEventGrid, // Use cleaned formData, not polluted one
              lobData: createdLead.lobData,
              assignedTo: createdLead.assignedTo,
              createdAt: createdLead.createdAt.toISOString(),
              // 🔧 ADD CONTACT FIELDS FOR RPA BOTS
              firstName: createdLead.firstName,
              lastName: createdLead.lastName,
              email: createdLead.email,
              phone: createdLead.phone,
              emirate: createdLead.emirate
            }
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-service-key': INTERNAL_SERVICE_KEY
            },
            timeout: 5000 // 5 second timeout
          }
        );
        
        httpFallbackTriggered = true;
        context.log(`✅ [HTTP FALLBACK] Pipeline Service responded: ${fallbackResponse.status}`);
        
      } catch (fallbackError: any) {
        context.error(`❌ [HTTP FALLBACK] Failed to call Pipeline Service:`, fallbackError.message);
      }
    }

    // Log trigger status
    if (eventPublished) {
      context.log(`[Event Grid] ✅ lead.created event published for lead ${createdLead.id}`);
      context.log(`[Event Grid] Pipeline Service will receive event and orchestrate plan fetching`);
    } else if (httpFallbackTriggered) {
      context.log(`[HTTP Fallback] ✅ Pipeline Service called directly for lead ${createdLead.id}`);
      context.log(`[HTTP Fallback] Plan fetching should proceed via HTTP fallback`);
    } else {
      context.error(`[CRITICAL] ❌ Both Event Grid AND HTTP fallback failed for lead ${createdLead.id}`);
      context.error(`[CRITICAL] Manual intervention required to trigger plan fetching`);
    }
    
    context.log(`Lead created successfully: ${createdLead.referenceId}`);

    // Return response immediately (don't wait for RPA trigger)
    return withCors(request, {
      status: 201,
      jsonBody: {
        success: true,
        message: 'Lead created successfully',
        data: {
          lead: createdLead,
          warnings: {
            isEmailRepeated,
            isPhoneRepeated,
            rpaTriggerStatus: eventPublished ? 'event_grid' : (httpFallbackTriggered ? 'http_fallback' : 'failed'),
            eventPublished,
            httpFallbackTriggered,
            customerAutoCreated,
            customerLinkedByEmail
          }
        }
      }
    });
  } catch (error: any) {
    context.error('Create lead error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to create lead',
        details: error.message
      }
    });
  }
}

app.http('createLead', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'leads',
  handler: createLead
});

