import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { listFormTemplates } from '../../lib/formDefinitionRepository';
import { jsonResponse, handleError } from '../../lib/httpResponses';
import { ensureAuthorized } from '../../lib/auth';
import { handlePreflight } from '../../lib/corsHelper';

const listTemplates = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    ensureAuthorized(request);
    const insuranceLine = request.query.get('insuranceLine') ?? undefined;
    const status = request.query.get('status') ?? undefined;
    const search = request.query.get('search') ?? undefined;
    const continuationToken =
      request.query.get('continuationToken') ?? undefined;
    const pageSize = request.query.get('pageSize');
    const { items, continuationToken: nextToken } = await listFormTemplates({
      insuranceLine,
      status,
      search,
      continuationToken,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined
    });
    context.log(
      `Returned ${items.length} templates${nextToken ? ' with continuation token' : ''
      }`
    );
    return jsonResponse(200, {
      items,
      total: items.length,
      continuationToken: nextToken
    });
  } catch (error) {
    context.error('Error listing templates', error);
    return handleError(error);
  }
};

app.http('ListFormTemplates', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'templates-list',
  handler: listTemplates
});

