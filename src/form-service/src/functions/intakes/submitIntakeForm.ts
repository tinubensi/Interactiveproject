import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import {
  createDraftIntake,
  getIntake,
  upsertIntake
} from '../../lib/intakeFormRepository';
import { getFormTemplate } from '../../lib/formDefinitionRepository';
import { jsonResponse, handleError } from '../../lib/httpResponses';
import { validateFormIntake } from '../../lib/validation';
import { normalizeFormDataForConnectors } from '../../lib/connectorMapper';
import { FormIntake } from '../../models/formTypes';
import { publishIntakeFormSubmittedEvent } from '../../lib/eventGridPublisher';
import { ensureAuthorized } from '../../lib/auth';
import { handlePreflight } from '../../lib/corsHelper';

type SubmitIntakePayload = Partial<FormIntake> & {
  templateId: string;
  insuranceLine: string;
  customerId: string;
};

const submitIntake = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    ensureAuthorized(request);
    const body = (await request.json()) as SubmitIntakePayload;
    context.log('Submitting intake form', {
      templateId: body.templateId,
      intakeId: body.intakeId
    });
    const templateId = body.templateId;
    if (!templateId || !body.insuranceLine) {
      return jsonResponse(400, {
        error: 'templateId and insuranceLine are required for submission'
      });
    }
    const template = await getFormTemplate(templateId, body.insuranceLine);
    if (!template) {
      return jsonResponse(404, { error: 'Template not found' });
    }

    let intake: FormIntake | null = null;
    if (body.intakeId) {
      intake = await getIntake(body.intakeId);
    }
    if (!intake) {
      intake = await createDraftIntake({
        templateId: template.templateId,
        insuranceLine: template.insuranceLine,
        customerId: body.customerId,
        status: 'draft',
        formDataRaw: body.formDataRaw ?? {},
        formDataNormalized: {},
        isRenewal: body.isRenewal,
        sourceEventId: body.sourceEventId
      });
    }

    const completed: FormIntake = {
      ...intake,
      ...body,
      id: intake.intakeId,
      intakeId: intake.intakeId,
      templateId: template.templateId,
      insuranceLine: template.insuranceLine,
      status: 'completed',
      formDataRaw: body.formDataRaw ?? intake.formDataRaw ?? {}
    };

    completed.formDataNormalized = await normalizeFormDataForConnectors(
      template,
      completed
    );

    validateFormIntake(completed);
    const saved = await upsertIntake(completed);
    await publishIntakeFormSubmittedEvent(saved);
    return jsonResponse(200, saved);
  } catch (error) {
    context.error('Error submitting intake', error);
    return handleError(error);
  }
};

app.http('SubmitIntakeForm', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'intakes',
  handler: submitIntake
});

