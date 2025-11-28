import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFormDataForConnectors } from '../lib/connectorMapper';
import { FormIntake, FormTemplate } from '../models/formTypes';

test('normalizeFormDataForConnectors maps and transforms fields', async () => {
  const template = {
    templateId: 'template-1',
    name: 'Test Template',
    insuranceLine: 'AUTO',
    organizationId: 'org',
    status: 'completed',
    version: 1,
    sections: [],
    connectors: [
      {
        portal: 'CarrierA',
        fieldMap: {
          firstName: 'full_name',
          email: 'contact_email'
        },
        transformations: {
          fullName: { type: 'concat', fields: ['firstName', 'lastName'] }
        }
      }
    ]
  } as FormTemplate;

  const intake = {
    id: 'intake-1',
    intakeId: 'intake-1',
    templateId: 'template-1',
    insuranceLine: 'AUTO',
    customerId: 'cust-1',
    status: 'draft',
    formDataRaw: {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com'
    },
    formDataNormalized: {}
  } as FormIntake;

  const normalized = await normalizeFormDataForConnectors(template, intake);
  assert.equal(normalized.CarrierA.full_name, 'Jane');
  assert.equal(normalized.CarrierA.fullName, 'Jane Doe');
  assert.equal(normalized.CarrierA.contact_email, 'jane@example.com');
});

