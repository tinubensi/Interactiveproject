/**
 * PipelineNotificationHandler - Event Grid trigger for pipeline notification events
 * Listens to pipeline.notification.required events from Pipeline Service
 */

import { app, EventGridEvent, InvocationContext } from '@azure/functions';
import { sendNotification, resolveRecipients } from '../../lib/notificationService';

/**
 * Pipeline notification type to template/channel mapping
 */
const PIPELINE_NOTIFICATION_MAP: Record<string, { 
  template: string; 
  channels: ('inApp' | 'email' | 'sms' | 'push')[];
}> = {
  'email_customer_stage_update': { 
    template: 'customer_stage_update', 
    channels: ['email', 'inApp'] 
  },
  'email_customer_quotation': { 
    template: 'customer_quotation', 
    channels: ['email'] 
  },
  'email_agent_assignment': { 
    template: 'agent_lead_assigned', 
    channels: ['email', 'inApp'] 
  },
  'email_agent_action_required': { 
    template: 'agent_action_required', 
    channels: ['email', 'inApp', 'push'] 
  },
  'sms_customer_stage_update': { 
    template: 'customer_stage_sms', 
    channels: ['sms'] 
  },
  'push_manager_alert': { 
    template: 'manager_alert', 
    channels: ['push', 'inApp'] 
  },
  'email_manager_escalation': { 
    template: 'manager_escalation', 
    channels: ['email', 'push'] 
  },
};

/**
 * Event data structure for pipeline notifications
 */
interface PipelineNotificationEventData {
  instanceId: string;
  leadId: string;
  lineOfBusiness: string;
  notificationType: string;
  channel: 'email' | 'sms' | 'push';
  recipientType: 'customer' | 'agent' | 'manager';
  templateId: string;
  customMessage?: string;
  leadReferenceId?: string;
  customerName?: string;
  stageName?: string;
  requestedAt: string;
}

/**
 * Resolve recipients based on recipient type
 * In a production system, this would call Lead/Staff service to get actual user IDs
 */
async function resolveRecipientsByType(
  recipientType: 'customer' | 'agent' | 'manager',
  leadId: string,
  context: InvocationContext
): Promise<string[]> {
  // TODO: Implement actual recipient resolution by calling Lead/Staff services
  // For now, return a placeholder that will be resolved later
  
  switch (recipientType) {
    case 'customer':
      // Would fetch customer contact from Lead Service
      context.log(`Resolving customer recipients for lead ${leadId}`);
      // Return lead ID as placeholder - actual implementation would get customer userId
      return [`lead:${leadId}:customer`];
      
    case 'agent':
      // Would fetch assigned agent from Lead Service
      context.log(`Resolving agent recipients for lead ${leadId}`);
      return [`lead:${leadId}:agent`];
      
    case 'manager':
      // Would fetch managers from Staff Management Service
      context.log(`Resolving manager recipients for lead ${leadId}`);
      return [`lead:${leadId}:manager`];
      
    default:
      context.warn(`Unknown recipient type: ${recipientType}`);
      return [];
  }
}

/**
 * Main handler for pipeline notification events
 */
export async function PipelineNotificationHandler(
  event: EventGridEvent,
  context: InvocationContext
): Promise<void> {
  context.log(`PipelineNotificationHandler processing event: ${event.eventType}`);

  // Only handle pipeline.notification.required events
  if (event.eventType !== 'pipeline.notification.required') {
    context.log(`Ignoring event type: ${event.eventType}`);
    return;
  }

  try {
    const data = event.data as unknown as PipelineNotificationEventData;
    
    context.log(`Processing notification: ${data.notificationType} for lead ${data.leadId}`);

    // Get template mapping
    const mapping = PIPELINE_NOTIFICATION_MAP[data.notificationType];
    
    if (!mapping) {
      context.warn(`No mapping found for notification type: ${data.notificationType}`);
      // Fall back to the templateId from the event if provided
      if (!data.templateId) {
        context.error(`No template available for notification type: ${data.notificationType}`);
        return;
      }
    }

    // Resolve recipients
    const recipients = await resolveRecipientsByType(
      data.recipientType, 
      data.leadId, 
      context
    );

    if (recipients.length === 0) {
      context.warn(`No recipients resolved for ${data.recipientType} on lead ${data.leadId}`);
      return;
    }

    // Try to resolve actual user IDs
    const resolvedRecipients = await resolveRecipients(recipients);
    
    if (resolvedRecipients.length === 0) {
      context.warn('No valid recipients after resolution');
      return;
    }

    // Build template variables
    const variables: Record<string, unknown> = {
      leadId: data.leadId,
      leadReference: data.leadReferenceId || data.leadId,
      customerName: data.customerName || 'Customer',
      stageName: data.stageName || 'Unknown Stage',
      lineOfBusiness: data.lineOfBusiness,
      instanceId: data.instanceId,
    };

    // Add custom message if provided
    if (data.customMessage) {
      variables.customMessage = data.customMessage;
    }

    // Determine template and channels to use
    const templateId = mapping?.template || data.templateId;
    const channels = mapping?.channels || [data.channel as 'email' | 'sms' | 'push', 'inApp'];

    // Send notification
    const result = await sendNotification({
      templateId,
      recipients: resolvedRecipients,
      variables,
      channels,
      source: {
        service: 'pipeline-service',
        entityType: 'pipeline-instance',
        entityId: data.instanceId,
        eventType: 'pipeline.notification.required',
      },
    });

    context.log(
      `Pipeline notification sent: ${result.summary.sent}/${result.summary.total} ` +
      `(type: ${data.notificationType}, lead: ${data.leadId})`
    );
  } catch (error) {
    context.error('PipelineNotificationHandler error:', error);
    // Don't throw - we don't want to fail the event processing
    // The notification failure should be logged but not block pipeline execution
  }
}

// Register the Event Grid handler
app.eventGrid('PipelineNotificationHandler', {
  handler: PipelineNotificationHandler,
});

