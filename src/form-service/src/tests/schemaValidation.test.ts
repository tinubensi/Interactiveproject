import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFormTemplate, validateFormIntake } from '../lib/validation';

test('validateFormTemplate throws on missing fields', () => {
  assert.throws(() =>
    validateFormTemplate({
      templateId: 'temp',
      name: 'Bad Template'
    } as unknown)
  );
});

test('validateFormIntake succeeds for minimal payload', () => {
  const result = validateFormIntake({
    id: 'i-1',
    intakeId: 'i-1',
    templateId: 't-1',
    insuranceLine: 'AUTO',
    customerId: 'c-1',
    status: 'draft',
    formDataRaw: {}
  });
  assert.equal(result.intakeId, 'i-1');
});

