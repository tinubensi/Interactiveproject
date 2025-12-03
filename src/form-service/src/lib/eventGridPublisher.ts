import { getConfig } from './config';
import { FormIntake } from '../models/formTypes';

interface EventGridEvent<T> {
  id: string;
  eventType: string;
  subject: string;
  eventTime: string;
  data: T;
  dataVersion: string;
}

export interface IntakeFormSubmittedEventData {
  intakeId: string;
  customerId: string;
  insuranceLine: string;
  formData: Record<string, unknown>;
}

export const publishIntakeFormSubmittedEvent = async (
  intake: FormIntake
) => {
  const config = getConfig();
  if (!config.eventGrid.topicEndpoint || !config.eventGrid.topicKey) {
    return;
  }

  const event: EventGridEvent<IntakeFormSubmittedEventData> = {
    id: intake.intakeId,
    eventType: 'IntakeFormSubmittedEvent',
    subject: `/intake/${intake.intakeId}`,
    eventTime: new Date().toISOString(),
    dataVersion: '1.0',
    data: {
      intakeId: intake.intakeId,
      customerId: intake.customerId,
      insuranceLine: intake.insuranceLine,
      formData: intake.formDataNormalized ?? intake.formDataRaw
    }
  };

  await fetch(config.eventGrid.topicEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'aeg-sas-key': config.eventGrid.topicKey
    },
    body: JSON.stringify([event])
  });
};

