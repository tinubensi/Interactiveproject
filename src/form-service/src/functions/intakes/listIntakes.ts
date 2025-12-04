import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { listIntakesByTemplate, listAllIntakes } from '../../lib/intakeFormRepository';
import { jsonResponse, handleError } from '../../lib/httpResponses';
import { ensureAuthorized, requirePermission, FORM_PERMISSIONS } from '../../lib/auth';
import { handlePreflight } from '../../lib/corsHelper';

const listIntakes = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, FORM_PERMISSIONS.FORMS_READ);
    const templateId = request.query.get('templateId') ?? undefined;
    const status = request.query.get('status') ?? undefined;
    const insuranceLine = request.query.get('insuranceLine') ?? undefined;
    const search = request.query.get('search') ?? undefined;
    const continuationToken = request.query.get('continuationToken') ?? undefined;
    const pageSize = request.query.get('pageSize');
    const parsedPageSize = pageSize ? parseInt(pageSize, 10) : undefined;

    let items: any[];
    let nextToken: string | undefined;

    if (templateId) {
      // Use existing function for template-specific listing
      const result = await listIntakesByTemplate(templateId, continuationToken);
      items = result.resources ?? [];
      nextToken = result.continuationToken;
    } else {
      // Use new function for listing all intakes with filters
      const result = await listAllIntakes({
        status,
        insuranceLine,
        search,
        continuationToken,
        pageSize: parsedPageSize
      });
      items = result.items;
      nextToken = result.continuationToken;
    }

    context.log(`Returned ${items.length} intakes${nextToken ? ' with continuation token' : ''}`);

    return jsonResponse(200, {
      items,
      total: items.length,
      continuationToken: nextToken
    });
  } catch (error) {
    context.error('Error listing intakes', error);
    return handleError(error);
  }
};

app.http('ListIntakes', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'intakes-list',
  handler: listIntakes
});

