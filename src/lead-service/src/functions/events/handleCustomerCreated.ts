/**
 * Handle Customer Created From Lead Event
 * Updates lead's customerId from temporary UUID to real customer ID
 * Triggered when Customer Service successfully creates a customer from lead data
 */

import { app, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService } from '../../services/cosmosService';
import { CustomerCreatedFromLeadEvent } from '../../models/events';

export async function handleCustomerCreated(
  eventGridEvent: any,
  context: InvocationContext
): Promise<void> {
  context.log('========================================');
  context.log('CUSTOMER CREATED FROM LEAD EVENT HANDLER');
  context.log('========================================');
  
  let eventData: CustomerCreatedFromLeadEvent['data'] | null = null;
  
  try {
    eventData = eventGridEvent.data as CustomerCreatedFromLeadEvent['data'];
    
    if (!eventData || !eventData.customerId || !eventData.tempCustomerId || !eventData.leadId) {
      context.error('Invalid CustomerCreatedFromLeadEvent: missing required fields');
      context.error('Event data:', JSON.stringify(eventGridEvent, null, 2));
      return;
    }
    
    context.log(`Processing customer creation success for lead: ${eventData.leadId}`);
    context.log(`Temp Customer ID: ${eventData.tempCustomerId}`);
    context.log(`Real Customer ID: ${eventData.customerId}`);
    
    // Get the lead by ID (without partition key since we don't have lineOfBusiness in event)
    const lead = await cosmosService.getLeadByIdWithoutPartition(eventData.leadId);
    
    if (!lead) {
      context.error(`Lead not found: ${eventData.leadId}`);
      return;
    }
    
    // Verify the temp customer ID matches
    if (lead.customerId !== eventData.tempCustomerId) {
      context.warn(`Customer ID mismatch for lead ${eventData.leadId}`);
      context.warn(`Expected temp ID: ${eventData.tempCustomerId}, but lead has: ${lead.customerId}`);
      // Continue anyway - the lead might have been updated elsewhere
    }
    
    // Update the lead with real customer ID
    const updateData: any = {
      customerId: eventData.customerId,
      customerCreationPending: false,
      updatedAt: new Date()
    };
    
    await cosmosService.updateLead(eventData.leadId, lead.lineOfBusiness, updateData);
    
    context.log(`✅ Lead ${eventData.leadId} updated with real customer ID: ${eventData.customerId}`);
    
    // Add timeline entry
    try {
      await cosmosService.createTimelineEntry({
        id: uuidv4(),
        leadId: eventData.leadId,
        stage: lead.currentStage,
        stageId: lead.stageId,
        remark: `Customer record created (ID: ${eventData.customerId})`,
        changedBy: 'system',
        changedByName: 'System',
        timestamp: new Date()
      });
      
      context.log('✅ Timeline entry added');
      
    } catch (timelineError: any) {
      context.error('❌ Failed to add timeline entry:', timelineError.message);
      // Don't throw - the main update was successful
    }
    
    context.log('========================================');
    context.log('CUSTOMER ID UPDATE COMPLETED SUCCESSFULLY');
    context.log('========================================');
    
  } catch (error: any) {
    context.error('========================================');
    context.error('CUSTOMER ID UPDATE FAILED');
    context.error('========================================');
    context.error('Error:', error.message);
    context.error('Stack:', error.stack);
    
    if (eventData) {
      context.error(`Lead ID: ${eventData.leadId}`);
      context.error(`Temp Customer ID: ${eventData.tempCustomerId}`);
      context.error(`Real Customer ID: ${eventData.customerId}`);
      context.error('ALERT: Manual customer ID update required for this lead');
    }
    
    // Don't throw - we don't want Event Grid to retry
    // The customer was created successfully, this is just a sync issue
  }
}

app.eventGrid('handleCustomerCreated', {
  handler: handleCustomerCreated,
});
