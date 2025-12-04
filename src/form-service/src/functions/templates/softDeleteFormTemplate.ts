import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { softDeleteFormTemplate } from '../../lib/formDefinitionRepository';
import { jsonResponse, handleError } from '../../lib/httpResponses';
import { ensureAuthorized, requirePermission, FORM_PERMISSIONS } from '../../lib/auth';
import { handlePreflight } from '../../lib/corsHelper';

const deleteTemplate = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, FORM_PERMISSIONS.FORMS_DELETE);
    const templateId = request.params.templateId;
    const insuranceLine = request.query.get('insuranceLine');
    const deletedBy = request.query.get('deletedBy') ?? 'system';
    if (!templateId || !insuranceLine) {
      return jsonResponse(400, {
        error: 'templateId and insuranceLine are required'
      });
    }
    context.log('Soft delete template request', { templateId });
    await softDeleteFormTemplate(templateId, insuranceLine, deletedBy);
    return jsonResponse(204, null);
  } catch (error) {
    context.error('Error deleting template', error);
    return handleError(error);
  }
};

app.http('SoftDeleteFormTemplate', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'templates-delete/{templateId}',
  handler: deleteTemplate
});

