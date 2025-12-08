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

    // Create lead object
    const lead: any = {
      type: 'lead', // Required for Cosmos DB queries
      id: uuidv4(),
      referenceId,
      lineOfBusiness: body.lineOfBusiness,
      businessType: body.businessType,
      customerId: body.customerId,
      firstName,
      lastName,
      fullName,
      email: body.email,
      phone: body.phone,
      emirate: body.emirate,
      formId: body.formId,
      formData: body.formData,
      lobData: body.lobData,
      assignedTo,
      ambassador: body.ambassador,
      agent: body.agent,
      source: body.source || 'Website',
      currentStage: 'Plans Fetching',
      stageId: 'stage-1',
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
      stage: 'Plans Fetching',
      stageId: 'stage-1',
      remark: 'Lead created - fetching plans from vendors',
      changedBy: body.assignedTo || 'system',
      changedByName: 'System',
      timestamp: new Date()
    });

    // Publish lead.created event to Event Grid (primary communication method)
    let eventPublished = false;
    try {
      await eventGridService.publishLeadCreated({
        leadId: createdLead.id,
        referenceId: createdLead.referenceId,
        customerId: createdLead.customerId,
        lineOfBusiness: createdLead.lineOfBusiness,
        businessType: createdLead.businessType,
        formId: createdLead.formId,
        formData: createdLead.formData,
        lobData: createdLead.lobData,
        assignedTo: createdLead.assignedTo,
        createdAt: createdLead.createdAt
      });
      eventPublished = true;
      context.log('lead.created event published successfully to Event Grid');
    } catch (eventError: any) {
      context.warn('Failed to publish lead.created event to Event Grid:', eventError.message);
      
      // HTTP Fallback: Only trigger plan fetching directly if Event Grid fails
      // This ensures plans are fetched even if Event Grid is unavailable
      try {
        const quotationGenServiceUrl = process.env.QUOTATION_GEN_SERVICE_URL || 'http://localhost:7082/api';
        context.log(`Event Grid failed, using HTTP fallback to trigger plan fetch at ${quotationGenServiceUrl}/plans/fetch`);
        
        const fetchResponse = await fetch(`${quotationGenServiceUrl}/plans/fetch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            leadId: createdLead.id,
            lineOfBusiness: createdLead.lineOfBusiness,
            businessType: createdLead.businessType,
            leadData: createdLead.lobData,
            forceRefresh: true
          })
        });
        
        if (fetchResponse.ok) {
          context.log('Plan fetching triggered successfully via HTTP fallback');
        } else {
          const errorText = await fetchResponse.text();
          context.warn(`Plan fetching HTTP trigger failed: ${fetchResponse.status} - ${errorText}`);
        }
      } catch (httpError: any) {
        // Log but don't fail - plan fetching can be triggered manually later
        context.error('HTTP fallback to trigger plan fetching also failed:', httpError.message);
      }
    }

    context.log(`Lead created successfully: ${createdLead.referenceId}`);

    // Return response
    return withCors(request, {
      status: 201,
      jsonBody: {
        success: true,
        message: 'Lead created successfully',
        data: {
          lead: createdLead,
          warnings: {
            isEmailRepeated,
            isPhoneRepeated
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

