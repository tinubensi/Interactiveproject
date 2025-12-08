import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getFormTemplate } from '../../lib/formDefinitionRepository';
import { jsonResponse, handleError } from '../../lib/httpResponses';
import { ensureAuthorized, requirePermission, FORM_PERMISSIONS } from '../../lib/auth';
import { handlePreflight } from '../../lib/corsHelper';

const getTemplate = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, FORM_PERMISSIONS.FORMS_READ);
    const templateId = request.params.templateId;
    const insuranceLine = request.query.get('insuranceLine');
    if (!templateId || !insuranceLine) {
      return jsonResponse(400, {
        success: false,
        error: 'templateId and insuranceLine are required'
      });
    }

    const template = await getFormTemplate(templateId, insuranceLine);
    if (!template) {
      return jsonResponse(404, { 
        success: false,
        error: 'Template not found' 
      });
    }
    return jsonResponse(200, template);
  } catch (error) {
    context.error('Error fetching template', error);
    return handleError(error);
  }
};

app.http('GetFormTemplate', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'templates/{templateId}',
  handler: getTemplate
});

