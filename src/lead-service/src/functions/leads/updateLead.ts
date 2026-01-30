/**
 * Update Lead Function
 * Updates an existing lead
 * Reference: Petli updateLead controller
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { validateUpdateLeadRequest, sanitizeInput } from '../../utils/validation';
import { UpdateLeadRequest } from '../../models/lead';
import { handlePreflight, withCors } from '../../utils/corsHelper';
import { ensureAuthorized, requirePermission, LEAD_PERMISSIONS } from '../../lib/auth';

export async function updateLead(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, LEAD_PERMISSIONS.LEADS_UPDATE);
    const id = request.params.id;
    const lineOfBusiness = request.query.get('lineOfBusiness');
    
    // Parse request body, handle empty or invalid JSON
    let body: UpdateLeadRequest;
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
      body = JSON.parse(requestBody) as UpdateLeadRequest;
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

    if (!id) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Lead ID is required'
        }
      });
    }

    if (!lineOfBusiness) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'lineOfBusiness query parameter is required'
        }
      });
    }

    // Validate request
    const validation = validateUpdateLeadRequest(body);
    if (!validation.valid) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Validation failed',
          details: validation.errors
        }
      });
    }

    // Get existing lead
    const existingLead = await cosmosService.getLeadById(id, lineOfBusiness);
    if (!existingLead) {
      return withCors(request, {
        status: 404,
        jsonBody: {
          success: false,
          error: 'Lead not found'
        }
      });
    }

    if (existingLead.deletedAt) {
      return withCors(request, {
        status: 410,
        jsonBody: {
          success: false,
          error: 'Cannot update deleted lead'
        }
      });
    }

    // Track changes for event
    const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

    // Prepare updates
    const updates: Partial<typeof existingLead> = {};

    if (body.firstName && body.firstName !== existingLead.firstName) {
      const newFirstName = sanitizeInput(body.firstName);
      updates.firstName = newFirstName;
      changes.push({ field: 'firstName', oldValue: existingLead.firstName, newValue: newFirstName });
    }

    if (body.lastName && body.lastName !== existingLead.lastName) {
      const newLastName = sanitizeInput(body.lastName);
      updates.lastName = newLastName;
      changes.push({ field: 'lastName', oldValue: existingLead.lastName, newValue: newLastName });
    }

    if (updates.firstName || updates.lastName) {
      updates.fullName = `${updates.firstName || existingLead.firstName} ${updates.lastName || existingLead.lastName}`;
    }

    if (body.email && body.email !== existingLead.email) {
      updates.email = body.email;
      changes.push({ field: 'email', oldValue: existingLead.email, newValue: body.email });
    }

    if (body.phone && body.phone.number !== existingLead.phone.number) {
      updates.phone = body.phone;
      changes.push({ field: 'phone', oldValue: existingLead.phone, newValue: body.phone });
    }

    if (body.emirate && body.emirate !== existingLead.emirate) {
      updates.emirate = body.emirate;
      changes.push({ field: 'emirate', oldValue: existingLead.emirate, newValue: body.emirate });
    }

    if (body.assignedTo && body.assignedTo !== existingLead.assignedTo) {
      updates.assignedTo = body.assignedTo;
      changes.push({ field: 'assignedTo', oldValue: existingLead.assignedTo, newValue: body.assignedTo });

      // Publish assignment event (optional - don't fail if Event Grid is down)
      try {
        await eventGridService.publishLeadAssigned({
          leadId: existingLead.id,
          referenceId: existingLead.referenceId,
          customerId: existingLead.customerId,
          previousAssignee: existingLead.assignedTo,
          newAssignee: body.assignedTo,
          assignedBy: body.assignedTo, // TODO: Get from auth context
          timestamp: new Date()
        });
      } catch (eventError) {
        context.warn('Failed to publish lead.assigned event (Event Grid unavailable)');
      }

      // Add timeline entry
      await cosmosService.createTimelineEntry({
        id: uuidv4(),
        leadId: existingLead.id,
        stage: existingLead.currentStage,
        stageId: existingLead.stageId,
        remark: `Assigned to ${body.assignedTo}`,
        changedBy: body.assignedTo,
        changedByName: 'User', // TODO: Get from auth context
        timestamp: new Date()
      });
    }

    if (body.lobData) {
      updates.lobData = {
        ...existingLead.lobData,
        ...body.lobData
      };
      changes.push({ field: 'lobData', oldValue: existingLead.lobData, newValue: updates.lobData });
    }

    if (body.formData) {
      // CRITICAL: Clean incoming formData to remove duplicate keys with different casings
      // Define canonical field names we want to keep
      const canonicalFields = [
        'firstName', 'lastName', 'email', 'phone', 'emirate',
        'nationality', 'effectiveDate', 'visaLocation', 'occupation', 
        'homeCountry', 'dateOfBirth', 'gender', 'emiratesId',
        'monthlySalaryRange', 'salaryRange', 'visaType', 'maritalStatus',
        'passportNumber', 'visaFileNumber', 'visaExpiryDate',
        'residentialLocation', 'countryOfResidence', 'currentlyInsured',
        '_fieldLabels', '_sectionLabels', 'title', 'relation'
      ];
      
      // Extract only canonical fields from incoming formData
      const cleanedFormData: any = {};
      Object.keys(body.formData).forEach(key => {
        // Keep canonical fields
        if (canonicalFields.includes(key) || 
            key.startsWith('lobData.') || 
            key.startsWith('section-') ||
            key.startsWith('_')) {
          cleanedFormData[key] = body.formData[key];
        }
      });
      
      // Merge with existing data properly - but also clean existing data
      // Clean existing formData to remove old duplicates
      const cleanedExistingFormData: any = {};
      Object.keys(existingLead.formData || {}).forEach(key => {
        if (canonicalFields.includes(key) || 
            key.startsWith('lobData.') || 
            key.startsWith('section-') ||
            key.startsWith('_')) {
          cleanedExistingFormData[key] = existingLead.formData[key];
        }
      });
      
      const mergedFormData = {
        ...cleanedExistingFormData, // Use cleaned existing data
        ...existingLead.lobData,    // Keep all existing LOB fields
        ...cleanedFormData           // Override with cleaned new values
      };
      
      updates.formData = mergedFormData;
      updates.lobData = mergedFormData; // Keep lobData in sync with formData
      
      // Store cleaned formData for use in Event Grid/HTTP fallback (don't use polluted updatedLead.formData)
      const cleanedFormDataForEvents = mergedFormData;
      
      changes.push({ field: 'formData', oldValue: existingLead.formData, newValue: cleanedFormData });
      
      // Extract top-level fields from formData if present
      // This ensures fields like emirate, firstName, etc. are updated at the top level
      if (body.formData.emirate || body.formData.residency) {
        const newEmirate = body.formData.emirate || body.formData.residency;
        if (newEmirate !== existingLead.emirate) {
          updates.emirate = newEmirate;
          changes.push({ field: 'emirate', oldValue: existingLead.emirate, newValue: newEmirate });
        }
      }
      
      if (body.formData.firstName && body.formData.firstName !== existingLead.firstName) {
        updates.firstName = body.formData.firstName;
        changes.push({ field: 'firstName', oldValue: existingLead.firstName, newValue: body.formData.firstName });
      }
      
      if (body.formData.lastName && body.formData.lastName !== existingLead.lastName) {
        updates.lastName = body.formData.lastName;
        changes.push({ field: 'lastName', oldValue: existingLead.lastName, newValue: body.formData.lastName });
      }
      
      if (body.formData.email && body.formData.email !== existingLead.email) {
        updates.email = body.formData.email;
        changes.push({ field: 'email', oldValue: existingLead.email, newValue: body.formData.email });
      }
      
      if (body.formData.phone && body.formData.phone !== existingLead.phone?.number) {
        updates.phone = { 
          number: body.formData.phone, 
          countryCode: existingLead.phone?.countryCode || '+971',
          isoCode: existingLead.phone?.isoCode || 'AE'
        };
        changes.push({ field: 'phone', oldValue: existingLead.phone, newValue: updates.phone });
      }
    }

    if (body.source && body.source !== existingLead.source) {
      updates.source = body.source;
      changes.push({ field: 'source', oldValue: existingLead.source, newValue: body.source });
    }

    if (body.isHotLead !== undefined && body.isHotLead !== existingLead.isHotLead) {
      updates.isHotLead = body.isHotLead;
      changes.push({ field: 'isHotLead', oldValue: existingLead.isHotLead, newValue: body.isHotLead });

      if (body.isHotLead) {
        // Publish hot lead marked event (optional - don't fail if Event Grid is down)
        try {
          await eventGridService.publishLeadHotLeadMarked({
            leadId: existingLead.id,
            referenceId: existingLead.referenceId,
            customerId: existingLead.customerId,
            markedBy: body.assignedTo, // TODO: Get from auth context
            timestamp: new Date()
          });
        } catch (eventError) {
          context.warn('Failed to publish lead.hot_lead_marked event (Event Grid unavailable)');
        }
      }
    }

    // Update lead
    let updatedLead = await cosmosService.updateLead(id, lineOfBusiness, updates);
    
    // CRITICAL: Replace formData with cleaned version if we cleaned it
    // This ensures Event Grid gets clean data, not polluted data from Cosmos DB
    if (updates.formData && body.formData) {
      updatedLead.formData = updates.formData;
      updatedLead.lobData = updates.lobData;
    }

    // Determine if plan-relevant fields changed
    // More robust detection - check for exact matches and field prefixes
    const planRelevantFields = ['lobData', 'formData', 'emirate', 'businessType', 'lineOfBusiness'];
    const hasPlanRelevantChanges = changes.some(change => {
      const fieldName = change.field.toLowerCase();
      return planRelevantFields.some(field => {
        const fieldLower = field.toLowerCase();
        // Exact match or starts with (case-insensitive)
        return fieldName === fieldLower || fieldName.startsWith(fieldLower);
      });
    });
    
    // Also check if emirate was changed directly (even if not in changes array)
    const emirateChanged = body.emirate && body.emirate !== existingLead.emirate;
    const finalHasPlanRelevantChanges = hasPlanRelevantChanges || emirateChanged;

    // Publish lead.updated event if there were changes (optional - don't fail if Event Grid is down)
    if (changes.length > 0) {
      try {
        await eventGridService.publishLeadUpdated({
          leadId: updatedLead.id,
          referenceId: updatedLead.referenceId,
          customerId: updatedLead.customerId,
          changes,
          updatedBy: body.assignedTo, // TODO: Get from auth context
          updatedAt: updatedLead.updatedAt
        });
        context.log('Lead updated event published successfully');
      } catch (eventError) {
        context.warn('Failed to publish lead.updated event (Event Grid unavailable):', eventError);
        // Don't fail the update if event publishing fails
      }
    }

    context.log(`Lead updated successfully: ${updatedLead.referenceId}. Plan-relevant changes: ${finalHasPlanRelevantChanges}`);
    context.log(`[AUTO REFETCH DEBUG] Changes detected: ${JSON.stringify(changes.map(c => c.field))}`);
    context.log(`[AUTO REFETCH DEBUG] Emirate changed: ${emirateChanged}`);
    context.log(`[AUTO REFETCH DEBUG] Current stage: ${updatedLead.currentStage}`);

    // AUTOMATIC REFETCH: Copy EXACT flow from createLead (which works!)
    // Remove the "Lead Created" check - refetch should work for any stage except terminal stages
    const terminalStages = ['Policy Issued', 'Lead Closed', 'Lead Cancelled'];
    const shouldTriggerRefetch = finalHasPlanRelevantChanges && !terminalStages.includes(updatedLead.currentStage);
    
    if (shouldTriggerRefetch) {
      context.log(`[AUTO REFETCH] Triggering refetch for lead ${updatedLead.id} (stage: ${updatedLead.currentStage})`);
      
      // Delete existing plans first
      try {
        await cosmosService.deletePlansForLead(updatedLead.id);
        context.log(`[AUTO REFETCH] Deleted existing plans`);
      } catch (deleteError: any) {
        context.warn(`[AUTO REFETCH] Failed to delete plans: ${deleteError.message}`);
      }
      
      // Update status to Plans Refetching
      // CRITICAL: This MUST succeed - if it fails, we still continue but log error
      let statusUpdateSucceeded = false;
      try {
        await cosmosService.updateLead(updatedLead.id, updatedLead.lineOfBusiness, {
          currentStage: 'Plans Refetching',
          stageId: 'stage-1',
          plansCount: 0,
          updatedAt: new Date()
        });
        statusUpdateSucceeded = true;
        context.log(`[AUTO REFETCH] ✅ Updated status to Plans Refetching`);
        
        // CRITICAL FIX: Re-fetch the lead to get the latest state after status update
        // This ensures we return the correct status to the frontend
        const freshLead = await cosmosService.getLeadById(updatedLead.id, updatedLead.lineOfBusiness);
        if (freshLead) {
          updatedLead = freshLead;
          context.log(`[AUTO REFETCH] Re-fetched lead to get latest status`);
        }
      } catch (statusError: any) {
        context.error(`[AUTO REFETCH] ❌ Failed to update status: ${statusError.message}`);
        context.error(`[AUTO REFETCH] Status update stack: ${statusError.stack}`);
        // Continue anyway - refetch should still work even if status update fails
      }
      
      // COPY EXACT FLOW FROM CREATE LEAD: Publish lead.created event (with isRefetch flag)
      let eventPublished = false;
      let httpFallbackTriggered = false;
      
      // CRITICAL: Use cleaned formData, not the potentially polluted one from Cosmos DB
      // Create clean formData for Event Grid (remove all duplicate keys)
      const cleanFormDataForEventGrid = (() => {
        const canonicalFields = [
          'firstName', 'lastName', 'email', 'phone', 'emirate',
          'nationality', 'effectiveDate', 'visaLocation', 'occupation', 
          'homeCountry', 'dateOfBirth', 'gender', 'emiratesId',
          'monthlySalaryRange', 'salaryRange', 'visaType', 'maritalStatus',
          'passportNumber', 'visaFileNumber', 'visaExpiryDate',
          'residentialLocation', 'countryOfResidence', 'currentlyInsured',
          '_fieldLabels', '_sectionLabels', 'title', 'relation'
        ];
        
        const cleaned: any = {};
        const formDataToClean = updatedLead.formData || updatedLead.lobData || {};
        
        Object.keys(formDataToClean).forEach(key => {
          if (canonicalFields.includes(key) || 
              key.startsWith('lobData.') || 
              key.startsWith('section-') ||
              key.startsWith('_')) {
            cleaned[key] = formDataToClean[key];
          }
        });
        
        // Also add lobData fields
        if (updatedLead.lobData) {
          Object.keys(updatedLead.lobData).forEach(key => {
            if (!cleaned.hasOwnProperty(key) && 
                typeof updatedLead.lobData[key] !== 'object' &&
                updatedLead.lobData[key] !== null) {
              cleaned[key] = updatedLead.lobData[key];
            }
          });
        }
        
        return cleaned;
      })();
      
      try {
        await eventGridService.publishLeadCreated({
          leadId: updatedLead.id,
          referenceId: updatedLead.referenceId,
          customerId: updatedLead.customerId,
          lineOfBusiness: updatedLead.lineOfBusiness,
          businessType: updatedLead.businessType,
          formId: updatedLead.formId,
          formData: cleanFormDataForEventGrid, // Use cleaned formData, not polluted one
          lobData: updatedLead.lobData, // lobData should be clean already
          assignedTo: updatedLead.assignedTo,
          createdAt: updatedLead.createdAt,
          firstName: updatedLead.firstName,
          lastName: updatedLead.lastName,
          email: updatedLead.email,
          phone: updatedLead.phone,
          emirate: updatedLead.emirate,
          isRefetch: true, // Flag to indicate this is a refetch
          refetchReason: 'Lead updated - refetching plans with new data'
        });
        eventPublished = true;
        context.log('[AUTO REFETCH] ✅ lead.created event published to Event Grid');
        
      } catch (eventError: any) {
        context.error('[AUTO REFETCH] ❌ Event Grid failed:', eventError.message);
        
        // HTTP FALLBACK: Call Pipeline Service directly (same as createLead)
        const PIPELINE_SERVICE_URL = process.env.PIPELINE_SERVICE_URL || 'https://func-nectaria-pipeline-dev.azurewebsites.net';
        const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || 'dev-internal-service-key-nectaria-2024';
        
        try {
          context.log(`[AUTO REFETCH HTTP FALLBACK] Calling Pipeline Service at ${PIPELINE_SERVICE_URL}`);
          
          const axios = (await import('axios')).default;
          const fallbackResponse = await axios.post(
            `${PIPELINE_SERVICE_URL}/api/pipeline/process-event`,
            {
              eventType: 'lead.created',
              subject: `leads/${updatedLead.id}`,
              data: {
                leadId: updatedLead.id,
                referenceId: updatedLead.referenceId,
                customerId: updatedLead.customerId,
                lineOfBusiness: updatedLead.lineOfBusiness,
                businessType: updatedLead.businessType,
                formId: updatedLead.formId,
                formData: cleanFormDataForEventGrid, // Use cleaned formData, not polluted one
                lobData: updatedLead.lobData, // lobData should be clean already
                assignedTo: updatedLead.assignedTo,
                createdAt: updatedLead.createdAt.toISOString(),
                firstName: updatedLead.firstName,
                lastName: updatedLead.lastName,
                email: updatedLead.email,
                phone: updatedLead.phone,
                emirate: updatedLead.emirate,
                isRefetch: true,
                refetchReason: 'Lead updated - refetching plans with new data'
              }
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'x-service-key': INTERNAL_SERVICE_KEY
              },
              timeout: 5000
            }
          );
          
          httpFallbackTriggered = true;
          context.log(`[AUTO REFETCH HTTP FALLBACK] ✅ Pipeline Service responded: ${fallbackResponse.status}`);
          
        } catch (fallbackError: any) {
          context.error(`[AUTO REFETCH HTTP FALLBACK] ❌ Failed:`, fallbackError.message);
        }
      }
      
      // Log status
      if (eventPublished) {
        context.log(`[AUTO REFETCH] ✅ Event Grid published - Pipeline will orchestrate RPA`);
      } else if (httpFallbackTriggered) {
        context.log(`[AUTO REFETCH] ✅ HTTP fallback succeeded - Pipeline will orchestrate RPA`);
      } else {
        context.error(`[AUTO REFETCH] ❌ BOTH Event Grid AND HTTP fallback failed!`);
      }
      
      // CRITICAL: Immediately trigger quotation service (same as refetchPlans does)
      // Add small delay to ensure status update propagates to frontend first
      context.log(`[AUTO REFETCH IMMEDIATE TRIGGER] Waiting 1 second for status update to propagate...`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      
      const quotationGenUrl = process.env.QUOTATION_GEN_SERVICE_URL || 'https://quotation-gen-service-74e1210c.azurewebsites.net/api';
      context.log(`[AUTO REFETCH IMMEDIATE TRIGGER] Triggering plan fetch for lead ${updatedLead.id} at ${quotationGenUrl}/plans/fetch`);
      
      // CRITICAL: Create clean payload for RPA - extract ONLY canonical fields
      // Never send polluted formData with duplicate keys to RPA bots
      // Use type assertion to access lobData properties since it's a union type
      const lobData = updatedLead.lobData as any;
      const formData = updatedLead.formData as any;
      
      const cleanRpaFormData: any = {
        // Extract ONLY canonical fields for RPA
        emirate: updatedLead.emirate,
        effectiveDate: lobData?.effectiveDate || formData?.effectiveDate,
        visaLocation: lobData?.visaLocation || formData?.visaLocation,
        occupation: lobData?.occupation || formData?.occupation,
        homeCountry: lobData?.homeCountry || formData?.homeCountry,
        nationality: lobData?.nationality || formData?.nationality,
        salaryRange: lobData?.salaryRange || lobData?.monthlySalaryRange,
        dateOfBirth: lobData?.dateOfBirth,
        gender: lobData?.gender,
      };
      
      // Add any other lobData fields that might be needed (but filter out duplicates)
      if (lobData) {
        Object.keys(lobData).forEach(key => {
          // Only add if not already set and it's a valid field
          if (!cleanRpaFormData.hasOwnProperty(key) && 
              typeof lobData[key] !== 'object' &&
              lobData[key] !== null &&
              lobData[key] !== undefined) {
            cleanRpaFormData[key] = lobData[key];
          }
        });
      }
      
      // Add retry logic for immediate trigger (same as refetchPlans)
      const maxRetries = 3;
      const retryDelays = [1000, 2000, 3000]; // 1s, 2s, 3s delays
      let planFetchTriggered = false;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          context.log(`[AUTO REFETCH IMMEDIATE TRIGGER] Attempt ${attempt + 1}/${maxRetries}`);
          
          const fetchResponse = await fetch(`${quotationGenUrl}/plans/fetch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-service-key': process.env.INTERNAL_SERVICE_KEY || 'dev-internal-service-key-nectaria-2024'
            },
            body: JSON.stringify({
              leadId: updatedLead.id,
              lineOfBusiness: updatedLead.lineOfBusiness,
              formData: cleanRpaFormData, // Send clean data, not polluted formData
              emirate: updatedLead.emirate,
              triggeredBy: 'lead-edit',
              timestamp: new Date().toISOString()
            }),
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });
          
          if (fetchResponse.ok) {
            const responseData = await fetchResponse.json().catch(() => ({}));
            context.log(`[AUTO REFETCH IMMEDIATE TRIGGER] ✅ Quotation service triggered successfully (attempt ${attempt + 1})`);
            context.log(`[AUTO REFETCH IMMEDIATE TRIGGER] Response: ${JSON.stringify(responseData)}`);
            planFetchTriggered = true;
            break; // Success - exit retry loop
          } else {
            const errorText = await fetchResponse.text().catch(() => 'Unknown error');
            context.warn(`[AUTO REFETCH IMMEDIATE TRIGGER] ⚠ Quotation service responded with status ${fetchResponse.status}: ${errorText}`);
            // If it's a client error (4xx), don't retry
            if (fetchResponse.status >= 400 && fetchResponse.status < 500) {
              context.error(`[AUTO REFETCH IMMEDIATE TRIGGER] Client error - not retrying`);
              break;
            }
            // Otherwise, retry on next iteration
          }
        } catch (triggerError: any) {
          const errorMessage = triggerError.message || 'Unknown error';
          context.error(`[AUTO REFETCH IMMEDIATE TRIGGER] ❌ Attempt ${attempt + 1} failed: ${errorMessage}`);
          
          // If it's the last attempt, log final failure
          if (attempt === maxRetries - 1) {
            context.error(`[AUTO REFETCH IMMEDIATE TRIGGER] ❌ Failed after ${maxRetries} attempts`);
          } else {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
          }
        }
      }
      
      if (!planFetchTriggered) {
        context.error(`[AUTO REFETCH IMMEDIATE TRIGGER] ❌ CRITICAL: Failed to trigger plan fetch after ${maxRetries} attempts!`);
        context.error(`[AUTO REFETCH IMMEDIATE TRIGGER] Lead ${updatedLead.id} may not refetch plans automatically`);
      }
    } else {
      // Log why refetch wasn't triggered
      if (!finalHasPlanRelevantChanges) {
        context.log(`[AUTO REFETCH] Skipped - no plan-relevant changes detected`);
      } else if (terminalStages.includes(updatedLead.currentStage)) {
        context.log(`[AUTO REFETCH] Skipped - lead is in terminal stage: ${updatedLead.currentStage}`);
      } else {
        context.warn(`[AUTO REFETCH] Skipped - unknown reason (hasPlanRelevantChanges: ${finalHasPlanRelevantChanges}, stage: ${updatedLead.currentStage})`);
      }
    }

    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Lead updated successfully',
        data: {
          lead: updatedLead,
          changes,
          shouldRefetchPlans: finalHasPlanRelevantChanges,
          refetchTriggered: shouldTriggerRefetch
        }
      }
    });
  } catch (error: any) {
    context.error('Update lead error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to update lead',
        details: error.message
      }
    });
  }
}

app.http('updateLead', {
  methods: ['PUT', 'PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'leads/{id}/update',
  handler: updateLead
});


