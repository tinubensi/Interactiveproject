import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ignoreUnmappedField } from '../../lib/unmappedFieldRepository';
import { jsonResponse, handleError } from '../../lib/httpResponses';
import { ensureAuthorized, requirePermission, FORM_PERMISSIONS } from '../../lib/auth';
import { handlePreflight } from '../../lib/corsHelper';

const ignoreUnmappedFieldHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, FORM_PERMISSIONS.FORMS_MANAGE);

    const fieldId = request.params.fieldId;
    if (!fieldId) {
      return jsonResponse(400, { error: 'fieldId is required' });
    }

    const body = (await request.json()) as { portalId: string };
    if (!body.portalId) {
      return jsonResponse(400, { error: 'portalId is required' });
    }

    // Get user from auth token
    const ignoredBy = userContext.userId;

    context.log('Ignoring unmapped field', { fieldId, portalId: body.portalId });

    const ignored = await ignoreUnmappedField(fieldId, body.portalId, ignoredBy);
    return jsonResponse(200, ignored);
  } catch (error) {
    context.error('Error ignoring unmapped field', error);
    return handleError(error);
  }
};

app.http('IgnoreUnmappedField', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'unmapped-fields/{fieldId}/ignore',
  handler: ignoreUnmappedFieldHandler
});

