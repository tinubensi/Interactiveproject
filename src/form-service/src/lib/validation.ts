import Ajv, { JSONSchemaType } from 'ajv';
import addFormats from 'ajv-formats';
import templateSchema from '../schemas/formTemplate.schema.json';
import intakeSchema from '../schemas/formIntake.schema.json';
import { FormTemplate, FormIntake } from '../models/formTypes';

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
addFormats(ajv);

const validateTemplateFn = ajv.compile<FormTemplate>(
  templateSchema as unknown as JSONSchemaType<FormTemplate>
);
const validateIntakeFn = ajv.compile<FormIntake>(
  intakeSchema as unknown as JSONSchemaType<FormIntake>
);

export const validateFormTemplate = (payload: unknown) => {
  if (!validateTemplateFn(payload)) {
    const messages =
      validateTemplateFn.errors?.map((err) => `${err.instancePath} ${err.message}`) ??
      [];
    throw new Error(`Invalid form template: ${messages.join(', ')}`);
  }
  return payload as FormTemplate;
};

export const validateFormIntake = (payload: unknown) => {
  if (!validateIntakeFn(payload)) {
    const messages =
      validateIntakeFn.errors?.map((err) => `${err.instancePath} ${err.message}`) ??
      [];
    throw new Error(`Invalid form intake: ${messages.join(', ')}`);
  }
  return payload as FormIntake;
};

