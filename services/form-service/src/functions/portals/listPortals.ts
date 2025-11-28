import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { listPortals } from '../../lib/portalRepository';
import { jsonResponse, handleError } from '../../lib/httpResponses';
import { ensureAuthorized } from '../../lib/auth';
import { handlePreflight } from '../../lib/corsHelper';

const listPortalsHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    ensureAuthorized(request);
    const search = request.query.get('search') || undefined;
    const continuationToken = request.query.get('continuationToken') || undefined;
    const pageSize = request.query.get('pageSize')
      ? parseInt(request.query.get('pageSize')!, 10)
      : undefined;

    context.log('Listing portals', { search, pageSize });

    const result = await listPortals({
      search,
      continuationToken,
      pageSize
    });

    return jsonResponse(200, result);
  } catch (error) {
    context.error('Error listing portals', error);
    return handleError(error);
  }
};

app.http('ListPortals', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'portals-list',
  handler: listPortalsHandler
});

