/**
 * Event Handler - Process all Event Grid events
 * Event Grid Trigger
 */

import { app, EventGridEvent, InvocationContext } from '@azure/functions';
import { createAuditLog } from '../lib/auditRepository';
import { mapEventToAuditLog, EventGridEvent as MappedEvent } from '../lib/eventMapper';
import { sanitizeChanges, sanitizePII } from '../lib/piiSanitizer';
import { isCriticalSecurityEvent, generateSecurityAlert } from '../lib/securityAlerter';
import { publishSecurityAlert } from '../lib/eventPublisher';

export async function EventHandler(
  event: EventGridEvent,
  context: InvocationContext
): Promise<void> {
  context.log('EventHandler processing event:', event.eventType);

  try {
    // Convert to our event format - eventTime can be string or Date
    const eventTime = typeof event.eventTime === 'string' 
      ? event.eventTime 
      : new Date(event.eventTime as unknown as string | number | Date).toISOString();
    
    const mappedEvent: MappedEvent = {
      id: event.id as string,
      eventType: event.eventType as string,
      subject: event.subject as string,
      eventTime,
      data: event.data as Record<string, unknown>,
      topic: (event as unknown as Record<string, unknown>).topic as string | undefined,
    };

    // Map event to audit log fields
    const auditData = mapEventToAuditLog(mappedEvent);

    // Sanitize PII from changes
    const sanitizedChanges = sanitizeChanges(auditData.changes);

    // Sanitize metadata if present
    const sanitizedMetadata = auditData.metadata 
      ? sanitizePII(auditData.metadata) as Record<string, unknown>
      : undefined;

    // Create audit log
    await createAuditLog({
      entityType: auditData.entityType,
      entityId: auditData.entityId,
      action: auditData.action,
      category: auditData.category,
      severity: auditData.severity,
      actor: auditData.actor,
      context: auditData.context,
      changes: sanitizedChanges,
      metadata: sanitizedMetadata,
      timestamp: auditData.timestamp,
    });

    context.log(`Audit log created for ${event.eventType}`);

    // Check for critical security events
    if (isCriticalSecurityEvent(mappedEvent)) {
      const alert = generateSecurityAlert(mappedEvent);
      if (alert) {
        await publishSecurityAlert(alert);
        context.log(`Security alert triggered: ${alert.alertType}`);
      }
    }
  } catch (error) {
    context.error('EventHandler error:', error);
    // Don't rethrow - we don't want to fail the function and lose the event
    // The error is logged and the event is considered processed
  }
}

app.eventGrid('EventHandler', {
  handler: EventHandler,
});

