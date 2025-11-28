import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getFormTemplate, updateFormTemplate } from '../../lib/formDefinitionRepository';
import { jsonResponse, handleError } from '../../lib/httpResponses';
import { validateFormTemplate } from '../../lib/validation';
import { FormTemplate } from '../../models/formTypes';
import { ensureAuthorized } from '../../lib/auth';
import { handlePreflight } from '../../lib/corsHelper';

const updateTemplate = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    ensureAuthorized(request);
    context.log('Updating template request received');
    const templateId = request.params.templateId;
    const insuranceLine = request.query.get('insuranceLine');
    if (!templateId || !insuranceLine) {
      return jsonResponse(400, {
        error: 'templateId and insuranceLine are required'
      });
    }

    const existing = await getFormTemplate(templateId, insuranceLine);
    if (!existing) {
      return jsonResponse(404, { error: 'Template not found' });
    }

    const body = (await request.json()) as Partial<FormTemplate>;
    const merged: FormTemplate = {
      ...existing,
      ...(body as Partial<FormTemplate>),
      templateId: existing.templateId,
      insuranceLine: existing.insuranceLine,
      version: existing.version + 1
    };
    validateFormTemplate(merged);
    const updated = await updateFormTemplate(merged);
    return jsonResponse(200, updated);
  } catch (error) {
    context.error('Error updating template', error);
    return handleError(error);
  }
};

app.http('UpdateFormTemplate', {
  methods: ['PUT', 'PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'templates-update/{templateId}',
  handler: updateTemplate
});

