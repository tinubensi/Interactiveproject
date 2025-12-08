import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createPortal } from '../../lib/portalRepository';
import { jsonResponse, handleError } from '../../lib/httpResponses';
import { PortalDefinition } from '../../models/portalTypes';
import { ensureAuthorized, requirePermission, FORM_PERMISSIONS } from '../../lib/auth';
import { handlePreflight } from '../../lib/corsHelper';

const createPortalHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, FORM_PERMISSIONS.FORMS_CREATE);
    const body = (await request.json()) as Omit<PortalDefinition, 'createdAt' | 'updatedAt'>;

    if (!body.portalId || !body.name) {
      return jsonResponse(400, { 
        success: false,
        error: 'portalId and name are required' 
      });
    }

    context.log('Creating portal', { portalId: body.portalId });
    const portal = await createPortal(body);
    return jsonResponse(201, portal);
  } catch (error) {
    context.error('Error creating portal', error);
    return handleError(error);
  }
};

app.http('CreatePortal', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portals',
  handler: createPortalHandler
});

