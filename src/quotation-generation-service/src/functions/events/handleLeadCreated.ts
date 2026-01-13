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
      
      // Trigger RPA via VM
      const vendorIds = rpaVendors.map((v: any) => v.id);
      const vmResults = await rpaVmService.fetchPlansFromAllVendors(
        leadId,
        lobData || {},
        vendorIds
      );
      
      // Count successful vendors
      const successfulVendorIds = vmResults.filter((r: any) => r.success).map((r: any) => r.vendorId);
      const totalPlans = vmResults.reduce((sum: number, r: any) => sum + r.plans.length, 0);
      
      context.log(`VM execution complete: ${successfulVendorIds.length}/${vendorIds.length} vendors successful, ${totalPlans} plans fetched`);
      
      // Update fetch request status
      await cosmosService.updateFetchRequest(fetchRequest.id, leadId, {
        status: 'completed',
        completedAt: new Date(),
        totalPlansFound: totalPlans,
        successfulVendors: successfulVendorIds
      });
      
      // Publish completion event
      try {
        await eventGridService.publishPlansFetchCompleted({
          leadId: leadId,
          fetchRequestId: fetchRequest.id,
          totalPlans: totalPlans,
          successfulVendors: successfulVendorIds,
          failedVendors: vendorIds.filter((id: string) => !successfulVendorIds.includes(id)),
          plans: []
        });
        context.log('Published plans.fetch.completed event');
      } catch (eventError) {
        context.warn('Failed to publish completion event:', eventError);
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
