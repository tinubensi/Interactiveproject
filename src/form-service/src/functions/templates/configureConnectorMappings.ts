import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getFormTemplate, updateFormTemplate } from '../../lib/formDefinitionRepository';
import { jsonResponse, handleError } from '../../lib/httpResponses';
import { FormTemplate } from '../../models/formTypes';
import { ensureAuthorized } from '../../lib/auth';
import { handlePreflight } from '../../lib/corsHelper';

const configureConnectors = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    ensureAuthorized(request);
    const templateId = request.params.templateId;
    const insuranceLine = request.query.get('insuranceLine');
    if (!templateId || !insuranceLine) {
      return jsonResponse(400, {
        success: false,
        error: 'templateId and insuranceLine are required'
      });
    }
    context.log('Configuring connectors', { templateId });
    const template = await getFormTemplate(templateId, insuranceLine);
    if (!template) {
      return jsonResponse(404, { 
        success: false,
        error: 'Template not found' 
      });
    }
    const body = (await request.json()) as Partial<FormTemplate>;
    const connectors = body.connectors;
    if (!Array.isArray(connectors)) {
      return jsonResponse(400, { 
        success: false,
        error: 'connectors array is required' 
      });
    }
    const updated: FormTemplate = {
      ...template,
      connectors: connectors as FormTemplate['connectors']
    };
    const result = await updateFormTemplate(updated);
    return jsonResponse(200, result);
  } catch (error) {
    context.error('Error configuring connectors', error);
    return handleError(error);
  }
};

app.http('ConfigureConnectorMappings', {
  methods: ['PUT', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'templates/{templateId}/connectors',
  handler: configureConnectors
});

