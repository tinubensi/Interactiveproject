import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { resolveUnmappedField, getUnmappedField } from '../../lib/unmappedFieldRepository';
import { updatePortal } from '../../lib/portalRepository';
import { getPortal } from '../../lib/portalRepository';
import { jsonResponse, handleError } from '../../lib/httpResponses';
import { FieldMapping } from '../../models/portalTypes';
import { ensureAuthorized } from '../../lib/auth';
import { handlePreflight } from '../../lib/corsHelper';

const resolveUnmappedFieldHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    ensureAuthorized(request);
    const fieldId = request.params.fieldId;
    if (!fieldId) {
      return jsonResponse(400, { 
        success: false,
        error: 'fieldId is required' 
      });
    }

    const body = (await request.json()) as {
      portalId: string;
      resolvedMapping: FieldMapping;
      updatePortal?: boolean; // Whether to update portal registry with this mapping
    };

    if (!body.portalId || !body.resolvedMapping) {
      return jsonResponse(400, { 
        success: false,
        error: 'portalId and resolvedMapping are required' 
      });
    }

    // Get user from auth token (simplified)
    const resolvedBy = 'system'; // TODO: Extract from auth token

    context.log('Resolving unmapped field', { fieldId, portalId: body.portalId });

    // Resolve the unmapped field
    const resolved = await resolveUnmappedField(
      fieldId,
      body.portalId,
      body.resolvedMapping,
      resolvedBy
    );

    // Optionally update portal registry with the new mapping
    if (body.updatePortal) {
      const portal = await getPortal(body.portalId);
      if (portal) {
        const unmappedField = await getUnmappedField(fieldId, body.portalId);
        if (unmappedField) {
          // Add mapping to portal defaults
          portal.defaultMappings[unmappedField.fieldName] = body.resolvedMapping;
          await updatePortal(portal);
        }
      }
    }

    return jsonResponse(200, resolved);
  } catch (error) {
    context.error('Error resolving unmapped field', error);
    return handleError(error);
  }
};

app.http('ResolveUnmappedField', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'unmapped-fields/{fieldId}/resolve',
  handler: resolveUnmappedFieldHandler
});

