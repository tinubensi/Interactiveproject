/**
 * Handle Lead Created Event
 * Auto-triggers plan fetching when a lead is created
 * Listens to lead.created event from Lead Service
 */

import { app, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { planFetchingService } from '../../services/planFetchingService';
import { LeadCreatedEvent } from '../../models/events';
import { PlanFetchRequest } from '../../models/plan';

export async function handleLeadCreated(
  eventGridEvent: any,
  context: InvocationContext
): Promise<void> {
  try {
    context.log('Received Event Grid event:', JSON.stringify(eventGridEvent, null, 2));
    
    // Handle both direct event data and wrapped Event Grid event
    let event: LeadCreatedEvent;
    if (eventGridEvent.data && eventGridEvent.eventType) {
      // Event Grid wrapped format
      event = eventGridEvent as LeadCreatedEvent;
    } else if (eventGridEvent.eventType) {
      // Direct Event Grid event
      event = eventGridEvent as LeadCreatedEvent;
    } else {
      // Array of events (Event Grid can send arrays)
      const events = Array.isArray(eventGridEvent) ? eventGridEvent : [eventGridEvent];
      event = events[0] as LeadCreatedEvent;
    }
    
    const data = event.data;

    context.log(`Received lead.created event for lead ${data.leadId}`);

    // Create fetch request
    const fetchRequest: PlanFetchRequest = {
      id: uuidv4(),
      leadId: data.leadId,
      lineOfBusiness: data.lineOfBusiness,
      businessType: data.businessType,
      leadData: data.lobData,
      status: 'fetching',
      totalVendors: 0,
      successfulVendors: [],
      failedVendors: [],
      unavailableVendors: [],
      totalPlansFound: 0,
      createdAt: new Date(),
      startedAt: new Date()
    };

    await cosmosService.createFetchRequest(fetchRequest);

    // Get vendors
    const vendors = await cosmosService.getVendorsByLOB(data.lineOfBusiness);

    // Publish fetch started event
    await eventGridService.publishPlansFetchStarted({
      leadId: data.leadId,
      fetchRequestId: fetchRequest.id,
      lineOfBusiness: data.lineOfBusiness,
      vendorCount: vendors.length
    });

    // Fetch plans
    const { plans, successfulVendors, failedVendors } = await planFetchingService.fetchPlansForLead({
      leadId: data.leadId,
      lineOfBusiness: data.lineOfBusiness,
      businessType: data.businessType,
      leadData: data.lobData,
      fetchRequestId: fetchRequest.id
    });

    // Save plans
    await cosmosService.createPlans(plans);

    // Mark recommended plan
    const recommendedPlan = planFetchingService.calculateRecommendedPlan(plans);
    if (recommendedPlan) {
      await cosmosService.updatePlan(recommendedPlan.id, data.leadId, { isRecommended: true });
    }

    // Update fetch request
    await cosmosService.updateFetchRequest(fetchRequest.id, data.leadId, {
      status: 'completed',
      totalVendors: vendors.length,
      successfulVendors,
      failedVendors,
      totalPlansFound: plans.length,
      completedAt: new Date()
    });

    // Publish fetch completed event with plans for Lead Service to save
    await eventGridService.publishPlansFetchCompleted({
      leadId: data.leadId,
      fetchRequestId: fetchRequest.id,
      totalPlans: plans.length,
      successfulVendors,
      failedVendors,
      plans // Include full plans array for Lead Service
    });

    context.log(`Auto-fetched ${plans.length} plans for lead ${data.leadId}`);
  } catch (error: any) {
    context.error('Handle lead created error:', error);
  }
}

app.eventGrid('handleLeadCreated', {
  handler: handleLeadCreated
});


