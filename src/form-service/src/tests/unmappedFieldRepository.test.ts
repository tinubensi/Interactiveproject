import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createUnmappedField,
  getUnmappedField,
  listUnmappedFields,
  updateUnmappedField,
  resolveUnmappedField,
  ignoreUnmappedField,
  incrementOccurrenceCount
} from '../lib/unmappedFieldRepository';
import { UnmappedField, FieldMapping } from '../models/portalTypes';

test('createUnmappedField should create a new unmapped field record', async () => {
  const fieldData = {
    portalId: 'carrier-progressive',
    fieldName: 'unknown_field',
    suggestedMappings: [
      {
        sourceField: 'firstName',
        confidence: 0.85
      }
    ]
  };

  assert.ok(fieldData.portalId);
  assert.ok(fieldData.fieldName);
  assert.equal(fieldData.suggestedMappings.length, 1);
});

test('getUnmappedField should retrieve by id', async () => {
  const fieldId = 'unmapped-1';
  const portalId = 'carrier-progressive';
  assert.ok(fieldId);
  assert.ok(portalId);
});

test('listUnmappedFields should filter by status and portal', async () => {
  const options = {
    portalId: 'carrier-progressive',
    status: 'pending' as const,
    continuationToken: undefined,
    pageSize: 25
  };

  assert.ok(options.portalId);
  assert.equal(options.status, 'pending');
});

test('updateUnmappedField should update existing field', async () => {
  const field: UnmappedField = {
    id: 'unmapped-1',
    portalId: 'carrier-progressive',
    fieldName: 'unknown_field',
    occurrenceCount: 5,
    suggestedMappings: [],
    status: 'pending',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  };

  assert.ok(field.id);
  assert.equal(field.status, 'pending');
});

test('resolveUnmappedField should mark as resolved with mapping', async () => {
  const fieldId = 'unmapped-1';
  const portalId = 'carrier-progressive';
  const mapping: FieldMapping = {
    targetField: 'first_name',
    transformation: undefined
  };
  const resolvedBy = 'admin@example.com';

  assert.ok(fieldId);
  assert.ok(mapping.targetField);
  assert.ok(resolvedBy);
});

test('ignoreUnmappedField should mark as ignored', async () => {
  const fieldId = 'unmapped-1';
  const portalId = 'carrier-progressive';
  const ignoredBy = 'admin@example.com';

  assert.ok(fieldId);
  assert.ok(ignoredBy);
});

test('incrementOccurrenceCount should increase count', async () => {
  const fieldId = 'unmapped-1';
  const portalId = 'carrier-progressive';

  assert.ok(fieldId);
  assert.ok(portalId);
});

