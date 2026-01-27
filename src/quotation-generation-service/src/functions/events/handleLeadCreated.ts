/**
 * Handle Lead Created Event
 * ENABLED: Automatically triggers plan fetching when a lead is created
 * Directly invokes the rpaVmService to fetch plans from vendors
 */

import { app, EventGridEvent, InvocationContext } from '@azure/functions';
import { rpaVmService } from '../../services/rpaVmService';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { v4 as uuidv4 } from 'uuid';

// 🔒 In-memory deduplication cache (leadId -> timestamp)
const processingCache = new Map<string, number>();
const DEDUP_WINDOW_MS = 3600000; // 60 minutes (1 hour) to block all old retries

/**
 * Main Event Grid handler for lead.created events
 * Automatically triggers plan fetching for RPA-enabled vendors
 */
async function handleLeadCreatedEvent(
  event: EventGridEvent | EventGridEvent[] | any,
  context: InvocationContext
): Promise<void> {
  context.log('=== Quotation Gen Service: handleLeadCreatedEvent RECEIVED ===');
  
  try {
    // Handle both single event and array of events
    const events = Array.isArray(event) ? event : [event];
    
    for (const evt of events) {
      const eventData = evt.data;
      const leadId = eventData.id || eventData.leadId;
      const lineOfBusiness = eventData.lineOfBusiness;
      const lobData = eventData.lobData;
      
      context.log(`Processing lead.created event for lead: ${leadId}`);
      
      // 🔍 CRITICAL DEBUG: Log what we received in the event
      context.log(`[CRITICAL DEBUG] Event data received:`);
      context.log(`  - Has formData: ${!!eventData.formData}`);
      context.log(`  - Has lobData: ${!!eventData.lobData}`);
      context.log(`  - Has id: ${!!eventData.id}`);
      context.log(`  - Has leadId: ${!!eventData.leadId}`);
      context.log(`  - Has firstName: ${!!eventData.firstName}`);
      context.log(`  - Has phone: ${!!eventData.phone}`);
      if (eventData.formData) {
        const sectionKeys = Object.keys(eventData.formData).filter((k: string) => k.startsWith('section-'));
        context.log(`  - formData section-* keys: ${sectionKeys.join(', ')}`);
        if (sectionKeys.length > 0) {
          const firstSection = eventData.formData[sectionKeys[0]];
          context.log(`  - ${sectionKeys[0]}: ${Array.isArray(firstSection) ? firstSection.length : 0} items`);
          if (Array.isArray(firstSection) && firstSection.length > 0) {
            context.log(`  - First dependent: ${firstSection[0].firstName || 'N/A'} ${firstSection[0].lastName || 'N/A'}`);
          }
        } else {
          context.log(`  - ⚠️ WARNING: formData exists but has NO section-* keys!`);
          context.log(`  - formData keys: ${Object.keys(eventData.formData).join(', ')}`);
        }
      } else {
        context.log(`  - ⚠️ WARNING: formData is MISSING from event!`);
      }
      
      if (!leadId || !lineOfBusiness) {
        context.warn('Missing leadId or lineOfBusiness in event data, skipping');
        continue;
      }
      
      // 🔒 DEDUPLICATION: Check if already processing recently (in-memory cache)
      const now = Date.now();
      const lastProcessed = processingCache.get(leadId);
      
      if (lastProcessed) {
        const timeSince = now - lastProcessed;
        if (timeSince < DEDUP_WINDOW_MS) {
          context.log(`⏭️  Skipping duplicate event - Lead ${leadId} was processed ${Math.round(timeSince/1000)}s ago`);
          continue; // Skip to next event
        }
      }
      
      // Mark this lead as being processed
      processingCache.set(leadId, now);
      
      // Cleanup old entries from cache (older than 10 minutes)
      for (const [cachedLeadId, timestamp] of processingCache.entries()) {
        if (now - timestamp > 600000) { // 10 minutes
          processingCache.delete(cachedLeadId);
        }
      }
      
      // Get RPA-enabled vendors
      const allVendors = await cosmosService.getVendorsByLOB(lineOfBusiness);
      const rpaVendors = allVendors.filter((v: any) => v.rpaEnabled === true);
      
      if (rpaVendors.length === 0) {
        context.log(`No RPA-enabled vendors for ${lineOfBusiness}, skipping`);
        continue;
      }
      
      context.log(`Found ${rpaVendors.length} RPA-enabled vendors`);
      
      // 🔍 DEBUG: Log what's in eventData to verify formData is present
      context.log(`[DEBUG] Event data structure check:`);
      context.log(`  - Has formData: ${!!eventData.formData}`);
      context.log(`  - Has lobData: ${!!eventData.lobData}`);
      context.log(`  - Has firstName: ${!!eventData.firstName}`);
      context.log(`  - Has phone: ${!!eventData.phone}`);
      if (eventData.formData) {
        const sectionKeys = Object.keys(eventData.formData).filter(k => k.startsWith('section-'));
        context.log(`  - formData section-* keys: ${sectionKeys.join(', ')}`);
        if (sectionKeys.length > 0) {
          const firstSection = eventData.formData[sectionKeys[0]];
          context.log(`  - ${sectionKeys[0]}: ${Array.isArray(firstSection) ? firstSection.length : 0} items`);
        }
      }
      
      // Create fetch request - Pass ALL event data to RPA, not just lobData
      // Ensure we include ALL fields including formData with dependents
      const leadDataForRpa = {
        ...eventData,
        id: leadId, // Ensure id is set
        leadId: leadId, // Also set leadId for compatibility
        // Explicitly ensure formData is included
        formData: eventData.formData || {},
        // Explicitly ensure lobData is included
        lobData: eventData.lobData || {}
      };
      
      const fetchRequest: any = {
        id: uuidv4(),
        leadId: leadId,
        lineOfBusiness: lineOfBusiness,
        businessType: eventData.businessType || 'individual',
        leadData: leadDataForRpa, // 🔧 PASS FULL EVENT DATA with explicit formData and lobData
        requestedAt: new Date(),
        status: 'processing',
        totalVendors: rpaVendors.length,
        successfulVendors: [],
        failedVendors: [],
        totalPlansFound: 0,
        vendors: rpaVendors.map((v: any) => v.id)
      };
      
      await cosmosService.createFetchRequest(fetchRequest);
      context.log(`Created fetch request: ${fetchRequest.id}`);
      
      // ✅ IMMEDIATE STATUS UPDATE: Update lead to "Plans Fetching" NOW
      // This ensures the timeline shows the correct status immediately without waiting for event propagation
      try {
        const LEAD_SERVICE_URL = process.env.LEAD_SERVICE_URL || 'https://lead-service-func.azurewebsites.net';
        
        // Update lead stage
        await fetch(`${LEAD_SERVICE_URL}/api/leads/${leadId}/stage`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-service-key': process.env.INTERNAL_SERVICE_KEY || ''
          },
          body: JSON.stringify({
            stage: 'Plans Fetching',
            stageId: 'stage-1',
            changedBy: 'quotation-gen-service',
            changedByName: 'Quotation Generation Service'
          })
        });
        
        // Create timeline entry
        await fetch(`${LEAD_SERVICE_URL}/api/leads/${leadId}/timeline`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-service-key': process.env.INTERNAL_SERVICE_KEY || ''
          },
          body: JSON.stringify({
            stage: 'Plans Fetching',
            stageId: 'stage-1',
            remark: `Started fetching plans from ${rpaVendors.length} vendors`,
            changedBy: 'quotation-gen-service',
            changedByName: 'Quotation Generation Service',
            timestamp: new Date().toISOString()
          })
        });
        context.log(`✅ Updated lead status and created timeline entry for "Plans Fetching"`);
      } catch (updateError) {
        context.warn('⚠️ Failed to update lead status immediately:', updateError);
        // Continue anyway - event-based updates will still work
      }
      
      // Publish plans.fetch_started event BEFORE triggering RPA
      // This allows Pipeline Service to update lead status to "Plans Fetching"
      try {
        await eventGridService.publishPlansFetchStarted({
          leadId: leadId,
          fetchRequestId: fetchRequest.id,
          lineOfBusiness: lineOfBusiness,
          vendorCount: rpaVendors.length
        });
        context.log(`✅ Published plans.fetch_started event`);
      } catch (eventError) {
        context.warn('⚠️ Failed to publish plans.fetch_started event:', eventError);
        // Continue anyway - RPA can still run
      }
      
      // Trigger RPA via VM
      // Build complete lead data for RPA (VM requires id field + all lead details)
      // CRITICAL: Use leadDataForRpa which already has formData explicitly included
      // Don't rebuild manually - that might lose formData if eventData.formData is undefined
      const completeLeadData = {
        ...leadDataForRpa,  // Start with leadDataForRpa which has formData
        id: leadId,         // Ensure id is set
        leadId: leadId,     // Also set leadId for compatibility
        lineOfBusiness: lineOfBusiness,  // Ensure lineOfBusiness is set
        // Explicitly ensure formData is included (even if undefined in eventData)
        formData: leadDataForRpa.formData || eventData.formData || {},
        // Explicitly ensure lobData is included
        lobData: leadDataForRpa.lobData || lobData || {}
      };
      
      // 🔍 CRITICAL DEBUG: Verify formData is in completeLeadData before sending to VM
      context.log(`[CRITICAL DEBUG] completeLeadData structure before sending to VM:`);
      context.log(`  - Has formData: ${!!completeLeadData.formData}`);
      context.log(`  - Has lobData: ${!!completeLeadData.lobData}`);
      if (completeLeadData.formData) {
        const sectionKeys = Object.keys(completeLeadData.formData).filter((k: string) => k.startsWith('section-'));
        context.log(`  - formData section-* keys: ${sectionKeys.join(', ')}`);
        if (sectionKeys.length > 0) {
          const firstSection = completeLeadData.formData[sectionKeys[0]];
          context.log(`  - ${sectionKeys[0]}: ${Array.isArray(firstSection) ? firstSection.length : 0} items`);
        }
      } else {
        context.log(`  - ⚠️ CRITICAL: formData is MISSING from completeLeadData!`);
      }
      
      const vendorIds = rpaVendors.map((v: any) => v.id);
      const vmResults = await rpaVmService.fetchPlansFromAllVendors(
        leadId,
        completeLeadData,
        vendorIds
      );
      
      // Count successful vendors from VM response
      const successfulVendorIds = vmResults.filter((r: any) => r.success).map((r: any) => r.vendorId);
      const totalPlansFromVM = vmResults.reduce((sum: number, r: any) => sum + r.plans.length, 0);
      
      context.log(`VM execution complete: ${successfulVendorIds.length}/${vendorIds.length} vendors successful, ${totalPlansFromVM} plans fetched`);
      
      // ✅ VERIFY plans are actually saved and queryable in database
      // This handles Cosmos DB eventual consistency
      let totalPlans = totalPlansFromVM; // Default to VM response
      
      try {
        context.log(`Verifying plans are saved in database...`);
        const verification = await rpaVmService.verifyPlansInDB(leadId);
        context.log(`✅ Verified ${verification.count} plans in DB from vendors: ${verification.vendors.join(', ')}`);
        
        // Use verified count if available, otherwise fallback to VM response
        if (verification.count > 0) {
          totalPlans = verification.count;
          context.log(`Using verified count: ${totalPlans} plans`);
        } else if (totalPlansFromVM > 0) {
          context.log(`⚠️ Verification returned 0, using VM response: ${totalPlansFromVM} plans`);
          totalPlans = totalPlansFromVM;
        } else {
          context.warn(`⚠️ Both verification and VM returned 0 plans`);
          totalPlans = 0;
        }
      } catch (verifyError) {
        context.error(`❌ Verification failed: ${verifyError}`);
        context.log(`Falling back to VM response count: ${totalPlansFromVM} plans`);
        totalPlans = totalPlansFromVM;
      }
      
      // Update fetch request status with plan count
      await cosmosService.updateFetchRequest(fetchRequest.id, leadId, {
        status: 'completed',
        completedAt: new Date(),
        totalPlansFound: totalPlans,
        successfulVendors: successfulVendorIds
      });
      
      // ALWAYS publish completion event (so pipeline can advance)
      // Even if totalPlans is 0, pipeline needs to know RPA finished
      try {
        await eventGridService.publishPlansFetchCompleted({
          leadId: leadId,
          fetchRequestId: fetchRequest.id,
          totalPlans: totalPlans,
          successfulVendors: successfulVendorIds,
          failedVendors: vendorIds.filter((id: string) => !successfulVendorIds.includes(id)),
          plans: []
        });
        context.log(`✅ Published plans.fetch.completed event with ${totalPlans} plans`);
      } catch (eventError) {
        context.error('❌ CRITICAL: Failed to publish completion event:', eventError);
        throw eventError; // Re-throw to ensure pipeline gets notified of failure
      }
      
      context.log(`✅ Successfully processed lead.created event for lead ${leadId}`);
    }
  } catch (error: any) {
    context.error('Error processing lead.created event:', error);
    throw error;
  }
}

app.eventGrid('handleLeadCreated', {
  handler: handleLeadCreatedEvent
});
