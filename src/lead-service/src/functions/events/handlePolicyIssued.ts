/**
 * Handle Policy Issued Event
 * Listens to policy.issued event from Policy Service
 * Updates lead with policyId and changes stage to "Policy Issued"
 * 
 * NOTE: If a pipeline is active for this lead, the Pipeline Service
 * handles stage changes. This handler only updates policy reference
 * and falls back to hardcoded stage change when no pipeline is active.
 */

import { app, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService } from '../../services/cosmosService';
import { PolicyIssuedEvent } from '../../models/events';
import { isLeadManagedByPipeline } from '../../services/pipelineServiceClient';

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

    // Check if this lead is managed by a pipeline
    const hasPipeline = await isLeadManagedByPipeline(data.leadId);
    if (hasPipeline) {
      context.log(`Lead ${data.leadId} is managed by pipeline - skipping hardcoded stage change`);
      // Still update policy reference but don't change stage
      await cosmosService.updateLead(lead.id, lead.lineOfBusiness, {
        policyId: data.policyId,
        updatedAt: new Date()
      });
      return;
    }

    // Fallback: No pipeline active - use hardcoded stage change
    context.log(`Lead ${data.leadId} has no active pipeline - using hardcoded stage change`);

    // Update lead with stage change
    await cosmosService.updateLead(lead.id, lead.lineOfBusiness, {
      policyId: data.policyId,
      currentStage: 'Policy Issued',
      stageId: 'stage-6',
      updatedAt: new Date()
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

