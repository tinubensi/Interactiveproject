import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import {
  createDraftIntake,
  getIntake,
  upsertIntake
} from '../../lib/intakeFormRepository';
import { jsonResponse, handleError } from '../../lib/httpResponses';
import { validateFormIntake } from '../../lib/validation';
import { FormIntake } from '../../models/formTypes';
import { ensureAuthorized } from '../../lib/auth';
import { handlePreflight } from '../../lib/corsHelper';

const autoSaveIntake = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    ensureAuthorized(request);
    const body = (await request.json()) as Partial<FormIntake>;
    context.log('Autosaving intake', { intakeId: body.intakeId });
    if (!body.templateId || !body.insuranceLine) {
      return jsonResponse(400, {
        error: 'templateId and insuranceLine are required'
      });
    }
    const baseCandidate = {
      ...(body as Partial<FormIntake>),
      id: body.intakeId ?? 'temp',
      intakeId: body.intakeId ?? 'temp',
      status: 'draft',
      createdAt: new Date().toISOString(),
      formDataRaw: body.formDataRaw ?? {},
      formDataNormalized: body.formDataNormalized ?? {}
    };
    validateFormIntake(baseCandidate);

    if (body.intakeId) {
      const existing = await getIntake(body.intakeId);
      if (!existing) {
        return jsonResponse(404, { error: 'Intake not found for autosave' });
      }
      const updated = await upsertIntake({
        ...existing,
        ...(body as Partial<FormIntake>),
        status: 'draft'
      });
      return jsonResponse(200, updated);
    }

    if (!body.templateId || !body.insuranceLine || !body.customerId) {
      return jsonResponse(400, {
        error: 'templateId, insuranceLine, and customerId are required'
      });
    }
    const created = await createDraftIntake({
      templateId: body.templateId,
      insuranceLine: body.insuranceLine,
      customerId: body.customerId,
      status: 'draft',
      formDataRaw: body.formDataRaw ?? {},
      formDataNormalized: body.formDataNormalized ?? {},
      isRenewal: body.isRenewal,
      sourceEventId: body.sourceEventId
    });
    return jsonResponse(201, created);
  } catch (error) {
    context.error('Error autosaving intake', error);
    return handleError(error);
  }
};

app.http('AutoSaveIntakeForm', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'intakes/autosave',
  handler: autoSaveIntake
});

