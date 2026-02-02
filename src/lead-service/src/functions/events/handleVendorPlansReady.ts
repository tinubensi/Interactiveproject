/**
 * Handle Vendor Plans Ready Event
 * Triggered when individual vendors complete plan fetching
 * Updates plansCount incrementally as each vendor completes
 */

import { app, EventGridEvent, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { v4 as uuidv4 } from 'uuid';

export async function handleVendorPlansReady(
  eventGridEvent: any,
  context: InvocationContext
): Promise<void> {
  context.log('=== Lead Service: handleVendorPlansReady RECEIVED ===');
  
  try {
    // Handle both single event and array of events
    const events = Array.isArray(eventGridEvent) ? eventGridEvent : [eventGridEvent];
    
    for (const event of events) {
      const eventData = event.data;
      const { leadId, vendorId, plansCount } = eventData;
      
      if (!leadId || !vendorId) {
        context.warn('Missing leadId or vendorId in event data, skipping');
        continue;
      }
      
      context.log(`Vendor ${vendorId} completed with ${plansCount} plans for lead ${leadId}`);
      
      // Get current lead
      const querySpec = {
        query: 'SELECT * FROM c WHERE c.id = @leadId AND c.type = "lead"',
        parameters: [{ name: '@leadId', value: leadId }]
      };
      
      const { resources: leads } = await cosmosService['leadsContainer'].items.query(querySpec).fetchAll();
      
      if (leads.length === 0) {
        context.warn(`Lead ${leadId} not found - cannot update plansCount`);
        continue;
      }
      
      const lead = leads[0];
      
      // Query actual plans count from DB (source of truth)
      // This ensures we always have the accurate count regardless of event timing
      const actualPlans = await cosmosService.getPlansForLead(leadId);
      
      // Deduplicate plans by planCode to get accurate count
      const uniquePlansCount = new Set(actualPlans.map((p: any) => p.planCode)).size;
      
      context.log(`DB query found ${actualPlans.length} total plans (${uniquePlansCount} unique)`);
      context.log(`Lead plansCount before update: ${lead.plansCount || 0}`);
      
      // Update plansCount to match DB reality
      await cosmosService.updateLead(leadId, lead.lineOfBusiness, {
        plansCount: uniquePlansCount,
        updatedAt: new Date()
      });
      
      context.log(`✅ Updated plansCount to ${uniquePlansCount} (was ${lead.plansCount || 0})`);
      
      // If this is the FIRST vendor (lead still in "Plans Fetching"), update stage
      if (lead.currentStage === 'Plans Fetching' && uniquePlansCount > 0) {
        context.log(`First vendor succeeded - updating stage to "Plans Available"`);
        
        await cosmosService.updateLead(leadId, lead.lineOfBusiness, {
          currentStage: 'Plans Available',
          stageId: 'stage-2'
        });
        
        await cosmosService.createTimelineEntry({
          id: uuidv4(),
          leadId,
          stage: 'Plans Available',
          previousStage: lead.currentStage,
          stageId: 'stage-2',
          remark: `First vendor (${vendorId}) returned ${plansCount} plans`,
          changedBy: 'system',
          changedByName: 'System',
          timestamp: new Date()
        });
        
        context.log(`✅ Stage updated to "Plans Available"`);
      } else if (lead.currentStage === 'Plans Available') {
        context.log(`Lead already in "Plans Available" - incremental update only (${lead.plansCount || 0} → ${uniquePlansCount})`);
      }
    }
  } catch (error: any) {
    context.error('Error handling vendor.plans_ready event:', error);
    // Don't throw - this is an event handler, failures should be logged but not block
  }
}

app.eventGrid('handleVendorPlansReady', {
  handler: handleVendorPlansReady
});
