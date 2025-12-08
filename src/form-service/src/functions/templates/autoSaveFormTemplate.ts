import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import {
  createFormTemplate,
  getFormTemplate,
  updateFormTemplate
} from '../../lib/formDefinitionRepository';
import { jsonResponse, handleError } from '../../lib/httpResponses';
import { validateFormTemplate } from '../../lib/validation';
import { FormTemplate } from '../../models/formTypes';
import { ensureAuthorized, requirePermission, FORM_PERMISSIONS } from '../../lib/auth';
import { handlePreflight } from '../../lib/corsHelper';

const autoSaveTemplate = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, FORM_PERMISSIONS.FORMS_UPDATE);
    const body = (await request.json()) as Partial<FormTemplate>;
    context.log('Autosaving template', { templateId: body.templateId });
    if (body.templateId) {
      if (!body.insuranceLine) {
        return jsonResponse(400, {
          success: false,
          error: 'insuranceLine is required when templateId is provided'
        });
      }
      const existing = await getFormTemplate(body.templateId, body.insuranceLine);
      if (!existing) {
        return jsonResponse(404, { 
          success: false,
          error: 'Template not found for autosave' 
        });
      }
      const merged: FormTemplate = {
        ...existing,
        ...body,
        insuranceLine: existing.insuranceLine, // Always use original - CRITICAL
        status: 'draft',
        version: existing.version
      };
      validateFormTemplate(merged);
      const updated = await updateFormTemplate(merged);
      return jsonResponse(200, updated);
    }
    const draftCandidate = {
      ...body,
      status: 'draft',
      templateId: 'temp',
      version: 1,
      createdAt: new Date().toISOString()
    };
    const validated = validateFormTemplate(draftCandidate);
    const { templateId: _t, version: _v, createdAt: _c, ...payload } =
      validated;
    const created = await createFormTemplate({
      ...payload,
      status: 'draft'
    });
    return jsonResponse(201, created);
  } catch (error) {
    context.error('Error auto saving template', error);
    return handleError(error);
  }
};

app.http('AutoSaveFormTemplate', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'templates/autosave',
  handler: autoSaveTemplate
});

