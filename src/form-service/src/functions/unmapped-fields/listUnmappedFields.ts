import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { listUnmappedFields } from '../../lib/unmappedFieldRepository';
import { jsonResponse, handleError } from '../../lib/httpResponses';
import { ensureAuthorized, requirePermission, FORM_PERMISSIONS } from '../../lib/auth';
import { handlePreflight } from '../../lib/corsHelper';
import { UnmappedFieldStatus } from '../../models/portalTypes';

const listUnmappedFieldsHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, FORM_PERMISSIONS.FORMS_MANAGE);
    const portalId = request.query.get('portalId') || undefined;
    const status = (request.query.get('status') as UnmappedFieldStatus) || undefined;
    const continuationToken = request.query.get('continuationToken') || undefined;
    const pageSize = request.query.get('pageSize')
      ? parseInt(request.query.get('pageSize')!, 10)
      : undefined;

    context.log('Listing unmapped fields', { portalId, status, pageSize });

    const result = await listUnmappedFields({
      portalId,
      status,
      continuationToken,
      pageSize
    });

    return jsonResponse(200, result);
  } catch (error) {
    context.error('Error listing unmapped fields', error);
    return handleError(error);
  }
};

app.http('ListUnmappedFields', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'unmapped-fields',
  handler: listUnmappedFieldsHandler
});

