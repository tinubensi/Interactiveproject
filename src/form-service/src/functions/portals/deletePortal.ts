import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { softDeletePortal } from '../../lib/portalRepository';
import { jsonResponse, handleError } from '../../lib/httpResponses';
import { ensureAuthorized, requirePermission, FORM_PERMISSIONS } from '../../lib/auth';
import { handlePreflight } from '../../lib/corsHelper';

const deletePortalHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, FORM_PERMISSIONS.FORMS_DELETE);

    const portalId = request.params.portalId;
    if (!portalId) {
      return jsonResponse(400, { 
        success: false,
        error: 'portalId is required' 
      });
    }

    // Get user from auth token
    const deletedBy = userContext.userId;

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

