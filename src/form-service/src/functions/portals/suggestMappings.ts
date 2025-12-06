import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { suggestMappings } from '../../lib/fieldMatcher';
import { jsonResponse, handleError } from '../../lib/httpResponses';
import { ensureAuthorized, requirePermission, FORM_PERMISSIONS } from '../../lib/auth';
import { handlePreflight } from '../../lib/corsHelper';

const suggestMappingsHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, FORM_PERMISSIONS.FORMS_MANAGE);
    const portalId = request.params.portalId;
    if (!portalId) {
      return jsonResponse(400, { error: 'portalId is required' });
    }

    const body = (await request.json()) as {
      targetFields: string[];
      sourceFields: string[];
      maxResults?: number;
    };

    if (!body.targetFields || !body.sourceFields) {
      return jsonResponse(400, {
        error: 'targetFields and sourceFields are required'
      });
    }

    context.log('Suggesting mappings', {
      portalId,
      targetFieldsCount: body.targetFields.length,
      sourceFieldsCount: body.sourceFields.length
    });

    const suggestions: Record<string, Array<{ sourceField: string; confidence: number }>> = {};

    for (const targetField of body.targetFields) {
      const fieldSuggestions = suggestMappings(
        targetField,
        body.sourceFields,
        body.maxResults || 3
      );
      suggestions[targetField] = fieldSuggestions;
    }

    return jsonResponse(200, { suggestions });
  } catch (error) {
    context.error('Error suggesting mappings', error);
    return handleError(error);
  }
};

app.http('SuggestMappings', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portals/{portalId}/suggest-mappings',
  handler: suggestMappingsHandler
});

