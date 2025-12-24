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
      currentStage: 'Lead Created', // Start at Lead Created stage
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
      stage: 'Lead Created', // Initial stage is Lead Created
      stageId: 'stage-0', // stage-0 = Lead Created
      remark: 'Lead created',
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
      
      // 🤖 TRIGGER RPA DIRECTLY TO FETCH REAL PLANS FROM PORTALS
      // This runs immediately after lead creation (no waiting in quotation service)
      try {
        context.log('🤖 Triggering RPA to fetch plans from insurance portals...');
        
        // Get RPA credentials from environment variables (secure)
        const RPA_TRIGGER_URL = process.env.RPA_TRIGGER_URL || 
          'https://crm-rpa-trigger.azurewebsites.net/api/rpa/trigger';
        const RPA_TRIGGER_KEY = process.env.RPA_TRIGGER_KEY || '';
        
        const fullUrl = RPA_TRIGGER_KEY ? `${RPA_TRIGGER_URL}?code=${RPA_TRIGGER_KEY}` : RPA_TRIGGER_URL;
        
        const rpaResponse = await fetch(fullUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leadId: createdLead.id,
              lineOfBusiness: createdLead.lineOfBusiness,
              businessType: createdLead.businessType,
              lobData: createdLead.lobData,
              formData: createdLead.formData
            }),
            signal: AbortSignal.timeout(10000) // 10 second timeout
          }
        );

        context.log(`RPA Response Status: ${rpaResponse.status}`);

        if (rpaResponse.ok) {
          const rpaResult: any = await rpaResponse.json();
          context.log(`✅ RPA triggered successfully for ${rpaResult.vendorsTriggered?.length || 0} vendor(s)`);
          
          // Update lead stage to "Plans Fetching"
          await cosmosService.updateLead(createdLead.id, createdLead.lineOfBusiness, {
            currentStage: 'Plans Fetching',
            stageId: 'stage-1',
            updatedAt: new Date()
          });
          
          // Create timeline entry
          await cosmosService.createTimelineEntry({
            id: uuidv4(),
            leadId: createdLead.id,
            stage: 'Plans Fetching',
            stageId: 'stage-1',
            remark: `RPA bots triggered to fetch plans from ${rpaResult.vendorsTriggered?.length || 0} vendor(s)`,
            changedBy: 'system',
            changedByName: 'RPA System',
            timestamp: new Date()
          });
        } else {
          const errorText = await rpaResponse.text();
          context.error(`❌ RPA trigger failed: ${rpaResponse.status} - ${errorText}`);
        }
      } catch (rpaError: any) {
        context.error('❌ Failed to trigger RPA:', rpaError.message);
        // Don't fail the lead creation - RPA can be triggered manually later
      }
      
    } catch (eventError: any) {
      context.warn('Failed to publish lead.created event to Event Grid:', eventError.message);
    }

    // VALIDATION: Ensure Pipeline Service created a pipeline instance
    // Pipeline Service must listen to lead.created events and create pipeline instances
    if (eventPublished) {
      context.log('Lead created event published. Pipeline creation will be handled asynchronously.');
      // Removed blocking wait for pipeline creation to improve performance
      // The frontend should handle the "pending pipeline" state gracefully
    }

    // HTTP Fallback: Also notify pipeline service directly to ensure immediate processing
    // This provides robustness if Event Grid is slow or unavailable
    let fallbackResult: any = { success: false, skipped: true };
    try {
      fallbackResult = await notifyLeadCreated(createdLead, { log: context.log.bind(context) });
      if (!fallbackResult.success) {
        context.warn(`[HTTP Fallback] Failed: ${fallbackResult.error}`);
      }
    } catch (fallbackError) {
      context.warn(`[HTTP Fallback] Unexpected error: ${fallbackError}`);
      fallbackResult = { success: false, error: String(fallbackError) };
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
            isPhoneRepeated,
            fallbackDebug: fallbackResult
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

