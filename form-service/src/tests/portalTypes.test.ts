import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PortalDefinition,
  FieldDefinition,
  FieldMapping,
  UnmappedField,
  UnmappedFieldStatus,
  SuggestedMapping
} from '../models/portalTypes';

test('PortalDefinition should have required fields', () => {
  const portal: PortalDefinition = {
    portalId: 'carrier-progressive',
    name: 'Progressive Insurance',
    description: 'Progressive carrier portal',
    fieldDefinitions: {
      firstName: {
        type: 'string',
        required: true,
        description: 'First name of the insured'
      }
    },
    defaultMappings: {
      firstName: {
        targetField: 'first_name',
        transformation: undefined
      }
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  };

  assert.equal(portal.portalId, 'carrier-progressive');
  assert.equal(portal.name, 'Progressive Insurance');
  assert.ok(portal.fieldDefinitions.firstName);
  assert.equal(portal.fieldDefinitions.firstName.type, 'string');
  assert.equal(portal.fieldDefinitions.firstName.required, true);
});

test('FieldDefinition should support all field types', () => {
  const stringField: FieldDefinition = {
    type: 'string',
    required: true
  };
  const numberField: FieldDefinition = {
    type: 'number',
    required: false
  };
  const dateField: FieldDefinition = {
    type: 'date',
    required: true,
    description: 'Date of birth'
  };
  const booleanField: FieldDefinition = {
    type: 'boolean',
    required: false
  };

  assert.equal(stringField.type, 'string');
  assert.equal(numberField.type, 'number');
  assert.equal(dateField.type, 'date');
  assert.equal(booleanField.type, 'boolean');
});

test('FieldMapping should support transformations', () => {
  const simpleMapping: FieldMapping = {
    targetField: 'full_name',
    transformation: undefined
  };

  const complexMapping: FieldMapping = {
    targetField: 'formatted_date',
    transformation: "$formatDate(dateOfBirth, '[Y0001]-[M01]-[D01]')"
  };

  assert.equal(simpleMapping.targetField, 'full_name');
  assert.equal(complexMapping.transformation, "$formatDate(dateOfBirth, '[Y0001]-[M01]-[D01]')");
});

test('UnmappedField should track field discovery', () => {
  const unmapped: UnmappedField = {
    id: 'unmapped-1',
    portalId: 'carrier-progressive',
    fieldName: 'unknown_field',
    occurrenceCount: 5,
    suggestedMappings: [
      {
        sourceField: 'firstName',
        confidence: 0.85
      }
    ],
    status: 'pending',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  };

  assert.equal(unmapped.portalId, 'carrier-progressive');
  assert.equal(unmapped.fieldName, 'unknown_field');
  assert.equal(unmapped.occurrenceCount, 5);
  assert.equal(unmapped.status, 'pending');
  assert.equal(unmapped.suggestedMappings.length, 1);
  assert.equal(unmapped.suggestedMappings[0].confidence, 0.85);
});

test('UnmappedField should support resolved status with mapping', () => {
  const resolved: UnmappedField = {
    id: 'unmapped-1',
    portalId: 'carrier-progressive',
    fieldName: 'unknown_field',
    occurrenceCount: 5,
    suggestedMappings: [],
    status: 'resolved',
    resolvedMapping: {
      targetField: 'first_name',
      transformation: undefined
    },
    resolvedAt: '2024-01-02T00:00:00Z',
    resolvedBy: 'admin@example.com',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z'
  };

  assert.equal(resolved.status, 'resolved');
  assert.ok(resolved.resolvedMapping);
  assert.equal(resolved.resolvedMapping?.targetField, 'first_name');
});

test('SuggestedMapping should have confidence score', () => {
  const suggestion: SuggestedMapping = {
    sourceField: 'firstName',
    confidence: 0.92
  };

  assert.equal(suggestion.sourceField, 'firstName');
  assert.ok(suggestion.confidence >= 0 && suggestion.confidence <= 1);
});

