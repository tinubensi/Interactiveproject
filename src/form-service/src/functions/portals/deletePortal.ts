import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { softDeletePortal } from '../../lib/portalRepository';
import { jsonResponse, handleError } from '../../lib/httpResponses';
import { ensureAuthorized } from '../../lib/auth';
import { handlePreflight } from '../../lib/corsHelper';

const deletePortalHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    ensureAuthorized(request);
    const portalId = request.params.portalId;
    if (!portalId) {
      return jsonResponse(400, { error: 'portalId is required' });
    }

    // Get user from auth token (simplified - adjust based on your auth implementation)
    const deletedBy = 'system'; // TODO: Extract from auth token

    context.log('Deleting portal', { portalId });
    await softDeletePortal(portalId, deletedBy);
    return jsonResponse(200, { message: 'Portal deleted successfully' });
  } catch (error) {
    context.error('Error deleting portal', error);
    return handleError(error);
  }
};

app.http('DeletePortal', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portals-delete/{portalId}',
  handler: deletePortalHandler
});

