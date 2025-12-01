/**
 * Handle Policy Issued Event
 * Listens to policy.issued event from Policy Service
 * Updates lead with policyId and changes stage to "Policy Issued"
 */

import { app, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService } from '../../services/cosmosService';
import { PolicyIssuedEvent } from '../../models/events';

export async function handlePolicyIssued(
  eventGridEvent: any,
  context: InvocationContext
): Promise<void> {
  try {
    const event = eventGridEvent as PolicyIssuedEvent;
    const data = event.data;

    context.log(`Received policy.issued event for lead ${data.leadId}`);

    // Get lead
    const query = {
      query: 'SELECT * FROM c WHERE c.id = @leadId AND NOT IS_DEFINED(c.deletedAt)',
      parameters: [{ name: '@leadId', value: data.leadId }]
    };

    const container = (cosmosService as any).leadsContainer;
    const { resources: leads } = await container.items.query(query).fetchAll();

    if (leads.length === 0) {
      context.warn(`Lead not found: ${data.leadId}`);
      return;
    }

    const lead = leads[0];

    // Update lead
    await cosmosService.updateLead(lead.id, lead.lineOfBusiness, {
      policyId: data.policyId,
      currentStage: 'Policy Issued',
      stageId: 'stage-6'
    });

    // Create timeline entry
    await cosmosService.createTimelineEntry({
      id: uuidv4(),
      leadId: lead.id,
      stage: 'Policy Issued',
      previousStage: lead.currentStage,
      stageId: 'stage-6',
      remark: `Policy ${data.policyNumber} issued successfully`,
      changedBy: 'system',
      changedByName: 'System',
      quotationId: data.quotationId,
      policyId: data.policyId,
      timestamp: new Date()
    });

    context.log(`Lead updated: ${lead.referenceId} - Policy Issued`);
  } catch (error: any) {
    context.error('Handle policy issued error:', error);
  }
}

app.eventGrid('handlePolicyIssued', {
  handler: handlePolicyIssued
});

