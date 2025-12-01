import { app, EventGridHandler } from '@azure/functions';
import { findOrCreateUnmappedField } from '../../lib/unmappedFieldRepository';
import { getPortal } from '../../lib/portalRepository';
import { suggestMappings } from '../../lib/fieldMatcher';

interface UnmappedFieldReportedEvent {
  portalId: string;
  fieldName: string;
  formDataFields?: string[]; // Available source fields for suggestion
}

const handleUnmappedFieldReported: EventGridHandler = async (event, context) => {
  const eventGridEvent = event.data as unknown as UnmappedFieldReportedEvent;
  try {
    context.log('Processing unmapped field report', {
      portalId: eventGridEvent.portalId,
      fieldName: eventGridEvent.fieldName
    });

    if (!eventGridEvent.portalId || !eventGridEvent.fieldName) {
      context.warn('Invalid unmapped field event', eventGridEvent);
      return;
    }

    // Verify portal exists
    const portal = await getPortal(eventGridEvent.portalId);
    if (!portal || portal.isDeleted) {
      context.warn('Portal not found or deleted', {
        portalId: eventGridEvent.portalId
      });
      return;
    }

    // Generate suggestions if source fields provided
    let suggestions: Array<{ sourceField: string; confidence: number }> = [];
    if (eventGridEvent.formDataFields && eventGridEvent.formDataFields.length > 0) {
      suggestions = suggestMappings(
        eventGridEvent.fieldName,
        eventGridEvent.formDataFields,
        3
      );
    }

    // Find or create unmapped field record
    await findOrCreateUnmappedField(
      eventGridEvent.portalId,
      eventGridEvent.fieldName,
      suggestions
    );

    context.log('Unmapped field processed successfully', {
      portalId: eventGridEvent.portalId,
      fieldName: eventGridEvent.fieldName,
      suggestionsCount: suggestions.length
    });
  } catch (error) {
    context.error('Error processing unmapped field report', error);
    throw error;
  }
};

app.eventGrid('UnmappedFieldReportedEventHandler', {
  handler: handleUnmappedFieldReported
});

