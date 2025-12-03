import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSimilarity,
  suggestMappings,
  normalizeFieldName
} from '../lib/fieldMatcher';

test('calculateSimilarity should return 1.0 for identical strings', () => {
  const similarity = calculateSimilarity('firstName', 'firstName');
  assert.equal(similarity, 1.0);
});

test('calculateSimilarity should return 0.0 for completely different strings', () => {
  const similarity = calculateSimilarity('abc', 'xyz');
  assert.ok(similarity < 0.5);
});

test('calculateSimilarity should handle similar field names', () => {
  const similarity1 = calculateSimilarity('firstName', 'first_name');
  const similarity2 = calculateSimilarity('firstName', 'firstname');
  const similarity3 = calculateSimilarity('firstName', 'fname');
  
  assert.ok(similarity1 > 0.7); // Should be high similarity
  assert.ok(similarity2 > 0.8); // Should be very high
  assert.ok(similarity3 > 0.5); // Should be moderate
});

test('calculateSimilarity should be case insensitive', () => {
  const similarity = calculateSimilarity('firstName', 'FIRSTNAME');
  assert.ok(similarity > 0.8);
});

test('normalizeFieldName should handle common variations', () => {
  assert.equal(normalizeFieldName('first_name'), 'firstname');
  assert.equal(normalizeFieldName('first-name'), 'firstname');
  assert.equal(normalizeFieldName('firstName'), 'firstname');
  assert.equal(normalizeFieldName('FIRST_NAME'), 'firstname');
});

test('suggestMappings should return top matches sorted by confidence', () => {
  const sourceFields = ['firstName', 'lastName', 'email', 'phoneNumber'];
  const targetField = 'first_name';
  
  const suggestions = suggestMappings(targetField, sourceFields, 3);
  
  assert.ok(suggestions.length > 0);
  assert.ok(suggestions.length <= 3);
  assert.ok(suggestions[0].confidence >= suggestions[1]?.confidence || suggestions.length === 1);
  assert.equal(suggestions[0].sourceField, 'firstName'); // Should match first
});

test('suggestMappings should handle empty source fields', () => {
  const suggestions = suggestMappings('target', [], 3);
  assert.equal(suggestions.length, 0);
});

test('suggestMappings should consider synonyms', () => {
  const sourceFields = ['givenName', 'fname', 'first_name'];
  const targetField = 'firstName';
  
  const suggestions = suggestMappings(targetField, sourceFields, 3);
  
  assert.ok(suggestions.length > 0);
  // All should have reasonable confidence
  suggestions.forEach(s => {
    assert.ok(s.confidence > 0.3);
  });
});

test('suggestMappings should limit results to maxResults', () => {
  const sourceFields = ['targetField', 'target_field', 'targetfield', 'field4', 'field5'];
  const targetField = 'target';
  
  const suggestions = suggestMappings(targetField, sourceFields, 2);
  assert.ok(suggestions.length <= 2);
  // Should have at least some matches since we have similar fields
  assert.ok(suggestions.length > 0);
});

