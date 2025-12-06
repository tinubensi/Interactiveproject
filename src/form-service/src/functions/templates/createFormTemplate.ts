import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createFormTemplate } from '../../lib/formDefinitionRepository';
import { jsonResponse, handleError } from '../../lib/httpResponses';
import { validateFormTemplate } from '../../lib/validation';
import { FormTemplate } from '../../models/formTypes';
import { ensureAuthorized, requirePermission, FORM_PERMISSIONS } from '../../lib/auth';
import { handlePreflight } from '../../lib/corsHelper';

type TemplatePayload = Partial<FormTemplate>;

const createTemplate = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, FORM_PERMISSIONS.FORMS_CREATE);
    const body = (await request.json()) as TemplatePayload;
    context.log('Creating template', {
      name: body.name,
      insuranceLine: body.insuranceLine
    });
    const templateCandidate = {
      ...(body as TemplatePayload),
      templateId: body.templateId ?? 'temp',
      version: 1,
      createdAt: new Date().toISOString()
    };
    const validated = validateFormTemplate(templateCandidate);
    const { templateId: _t, version: _v, createdAt: _c, ...createPayload } =
      validated;
    const created = await createFormTemplate({
      ...createPayload,
      status: validated.status ?? 'draft'
    });
    context.log(`Created template ${created.templateId}`);
    return jsonResponse(201, created);
  } catch (error) {
    context.error('Error creating template', error);
    return handleError(error);
  }
};

app.http('CreateFormTemplate', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'templates',
  handler: createTemplate
});

