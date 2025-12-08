import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getPortal } from '../../lib/portalRepository';
import { jsonResponse, handleError } from '../../lib/httpResponses';
import { ensureAuthorized, requirePermission, FORM_PERMISSIONS } from '../../lib/auth';
import { handlePreflight } from '../../lib/corsHelper';

const getPortalHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, FORM_PERMISSIONS.FORMS_READ);
    const portalId = request.params.portalId;
    if (!portalId) {
      return jsonResponse(400, { 
        success: false,
        error: 'portalId is required' 
      });
    }

    context.log('Getting portal', { portalId });
    const portal = await getPortal(portalId);
    if (!portal) {
      return jsonResponse(404, { 
        success: false,
        error: 'Portal not found' 
      });
    }

    return jsonResponse(200, portal);
  } catch (error) {
    context.error('Error getting portal', error);
    return handleError(error);
  }
};

app.http('GetPortal', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portals/{portalId}',
  handler: getPortalHandler
});

