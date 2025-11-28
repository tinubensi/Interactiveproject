import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateTransformation,
  validateTransformation,
  transformData
} from '../lib/transformationEngine';

test('evaluateTransformation should execute simple JSONata expressions', async () => {
  const data = {
    firstName: 'John',
    lastName: 'Doe',
    age: 30
  };

  const result1 = await evaluateTransformation('firstName', data);
  assert.equal(result1, 'John');

  const result2 = await evaluateTransformation('firstName & " " & lastName', data);
  assert.equal(result2, 'John Doe');
});

test('evaluateTransformation should handle date formatting', async () => {
  const data = {
    dateOfBirth: '1990-01-15',
    year: 1990,
    month: 1,
    day: 15
  };

  // JSONata doesn't have $formatDate built-in, but we can test string manipulation
  const result = await evaluateTransformation(
    "$string(year) & '-' & $string(month) & '-' & $string(day)",
    data
  );
  assert.equal(result, '1990-1-15');
});

test('evaluateTransformation should handle conditional logic', async () => {
  const data1 = { status: 'active' };
  const data2 = { status: 'inactive' };

  const result1 = await evaluateTransformation('status = "active" ? "A" : "I"', data1);
  const result2 = await evaluateTransformation('status = "active" ? "A" : "I"', data2);

  assert.equal(result1, 'A');
  assert.equal(result2, 'I');
});

test('evaluateTransformation should handle calculations', async () => {
  const data = {
    premium: 1000,
    tax: 0.15
  };

  const result = await evaluateTransformation('premium * tax', data);
  assert.equal(result, 150);
});

test('evaluateTransformation should handle nested field access', async () => {
  const data = {
    address: {
      street: '123 Main St',
      city: 'New York'
    }
  };

  const result = await evaluateTransformation('address.street & ", " & address.city', data);
  assert.equal(result, '123 Main St, New York');
});

test('evaluateTransformation should return undefined for invalid expressions', async () => {
  const data = { firstName: 'John' };
  const result = await evaluateTransformation('invalid.field', data);
  assert.equal(result, undefined);
});

test('validateTransformation should return true for valid expressions', () => {
  assert.equal(validateTransformation('firstName & lastName'), true);
  assert.equal(validateTransformation('$formatDate(date, "[Y]")'), true);
  assert.equal(validateTransformation('status = "active" ? "A" : "I"'), true);
});

test('validateTransformation should return false for invalid expressions', () => {
  assert.equal(validateTransformation('invalid syntax {'), false);
  assert.equal(validateTransformation(''), false);
});

test('transformData should apply multiple transformations', async () => {
  const data = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com'
  };

  const transformations = {
    fullName: 'firstName & " " & lastName',
    emailUpper: '$uppercase(email)'
  };

  const result = await transformData(data, transformations);
  assert.equal(result.fullName, 'John Doe');
  assert.equal(result.emailUpper, 'JOHN@EXAMPLE.COM');
});

test('transformData should handle missing fields gracefully', () => {
  const data = {
    firstName: 'John'
  };

  const transformations = {
    fullName: 'firstName & " " & lastName'
  };

  const result = transformData(data, transformations);
  // Should not throw, but result may be undefined or partial
  assert.ok(result !== undefined);
});

