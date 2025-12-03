import { app, EventGridHandler } from '@azure/functions';
import {
  createDraftIntake,
  getIntake
} from '../../lib/intakeFormRepository';
import {
  getFormTemplate,
  listFormTemplates
} from '../../lib/formDefinitionRepository';

interface RenewalInitiatedEventData {
  templateId?: string;
  insuranceLine: string;
  customerId: string;
  policyData: Record<string, unknown>;
  intakeId?: string;
}

const handleRenewalInitiated: EventGridHandler = async (event, context) => {
  const data = event.data as unknown as RenewalInitiatedEventData;
  context.log('RenewalInitiatedEvent received', data);

  let template =
    (data.templateId &&
      (await getFormTemplate(data.templateId, data.insuranceLine))) ||
    null;

  if (!template) {
    const { items } = await listFormTemplates({
      insuranceLine: data.insuranceLine,
      status: 'completed',
      pageSize: 1
    });
    template = items[0] ?? null;
  }

  if (!template) {
    context.warn('No template found for insurance line', data.insuranceLine);
    return;
  }

  if (data.intakeId) {
    const existing = await getIntake(data.intakeId);
    if (existing) {
      context.log('Intake already exists for renewal', data.intakeId);
      return;
    }
  }

  await createDraftIntake({
    templateId: template.templateId,
    insuranceLine: template.insuranceLine,
    customerId: data.customerId,
    status: 'draft',
    formDataRaw: data.policyData ?? {},
    formDataNormalized: {},
    isRenewal: true,
    sourceEventId: event.id
  });
};

app.eventGrid('RenewalInitiatedEventHandler', {
  handler: handleRenewalInitiated
});

