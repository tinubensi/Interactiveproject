import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getPortal, updatePortal } from '../../lib/portalRepository';
import { jsonResponse, handleError } from '../../lib/httpResponses';
import { PortalDefinition } from '../../models/portalTypes';
import { ensureAuthorized, requirePermission, FORM_PERMISSIONS } from '../../lib/auth';
import { handlePreflight } from '../../lib/corsHelper';

const updatePortalHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, FORM_PERMISSIONS.FORMS_UPDATE);
    const portalId = request.params.portalId;
    if (!portalId) {
      return jsonResponse(400, { 
        success: false,
        error: 'portalId is required' 
      });
    }

    const body = (await request.json()) as Partial<PortalDefinition>;
    context.log('Updating portal', { portalId });

    const existing = await getPortal(portalId);
    if (!existing) {
      return jsonResponse(404, { 
        success: false,
        error: 'Portal not found' 
      });
    }

    const updated: PortalDefinition = {
      ...existing,
      ...body,
      portalId: existing.portalId // Don't allow changing portalId
    };

    const result = await updatePortal(updated);
    return jsonResponse(200, result);
  } catch (error) {
    context.error('Error updating portal', error);
    return handleError(error);
  }
};

app.http('UpdatePortal', {
  methods: ['PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portals-update/{portalId}',
  handler: updatePortalHandler
});

