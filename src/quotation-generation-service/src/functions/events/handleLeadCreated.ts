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
      
      if (!leadId || !lineOfBusiness) {
        context.warn('Missing leadId or lineOfBusiness in event data, skipping');
        continue;
      }
      
      // Get RPA-enabled vendors
      const allVendors = await cosmosService.getVendorsByLOB(lineOfBusiness);
      const rpaVendors = allVendors.filter((v: any) => v.rpaEnabled === true);
      
      if (rpaVendors.length === 0) {
        context.log(`No RPA-enabled vendors for ${lineOfBusiness}, skipping`);
        continue;
      }
      
      context.log(`Found ${rpaVendors.length} RPA-enabled vendors`);
      
      // Create fetch request
      const fetchRequest: any = {
        id: uuidv4(),
        leadId: leadId,
        lineOfBusiness: lineOfBusiness,
        businessType: eventData.businessType || 'individual',
        leadData: lobData || {},
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
      const completeLeadData = {
        id: leadId,
        leadId: leadId,
        firstName: eventData.firstName,
        lastName: eventData.lastName,
        email: eventData.email,
        phone: eventData.phone,
        emirate: eventData.emirate,
        lineOfBusiness: lineOfBusiness,
        businessType: eventData.businessType || 'individual',
        ...lobData, // Spread lobData last so it can override any duplicates
      };
      
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
