/**
 * Tests for Canonical EMAF Types
 * TDD: RED Phase - Tests written before implementation
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { UnifiedEmafData } from '../../models/canonicalEmafTypes';

describe('UnifiedEmafData - Maternity Section', () => {
  it('should accept maternity data with all fields', () => {
    const data: UnifiedEmafData = {
      policyHolder: {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+971501234567',
      },
      insuredMembers: [],
      previousInsurance: {
        hasInsurance: false,
        members: [],
      },
      maternity: {
        currentlyPregnant: true,
        currentlyPregnantMemberName: 'Jane Doe',
        currentlyPregnantDetails: '8 weeks pregnant',
        tryingToGetPregnant: false,
        tryingToGetPregnantMemberName: undefined,
        tryingToGetPregnantDetails: undefined,
        lastMenstrualPeriod: '2024-01-15',
        historyComplications: true,
        historyComplicationsMemberName: 'Jane Doe',
        historyComplicationsDetails: 'Previous C-section',
        infertilityTreatment: false,
        infertilityTreatmentMemberName: undefined,
        infertilityTreatmentDetails: undefined,
        ultrasoundReport: 'Normal single fetus',
      },
    };

    assert.strictEqual(data.maternity?.currentlyPregnant, true);
    assert.strictEqual(data.maternity?.currentlyPregnantMemberName, 'Jane Doe');
    assert.strictEqual(data.maternity?.currentlyPregnantDetails, '8 weeks pregnant');
    assert.strictEqual(data.maternity?.lastMenstrualPeriod, '2024-01-15');
    assert.strictEqual(data.maternity?.historyComplications, true);
    assert.strictEqual(data.maternity?.ultrasoundReport, 'Normal single fetus');
  });

  it('should accept maternity data with partial fields', () => {
    const data: UnifiedEmafData = {
      policyHolder: {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+971501234567',
      },
      insuredMembers: [],
      previousInsurance: {
        hasInsurance: false,
        members: [],
      },
      maternity: {
        currentlyPregnant: false,
        lastMenstrualPeriod: '2024-01-15',
      },
    };

    assert.strictEqual(data.maternity?.currentlyPregnant, false);
    assert.strictEqual(data.maternity?.lastMenstrualPeriod, '2024-01-15');
    assert.strictEqual(data.maternity?.currentlyPregnantMemberName, undefined);
  });

  it('should accept data without maternity section', () => {
    const data: UnifiedEmafData = {
      policyHolder: {
        fullName: 'John Doe',
        email: 'john@example.com',
        phone: '+971501234567',
      },
      insuredMembers: [],
      previousInsurance: {
        hasInsurance: false,
        members: [],
      },
    };

    assert.strictEqual(data.maternity, undefined);
  });

  it('should accept maternity data with all NO answers', () => {
    const data: UnifiedEmafData = {
      policyHolder: {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+971501234567',
      },
      insuredMembers: [],
      previousInsurance: {
        hasInsurance: false,
        members: [],
      },
      maternity: {
        currentlyPregnant: false,
        tryingToGetPregnant: false,
        historyComplications: false,
        infertilityTreatment: false,
      },
    };

    assert.strictEqual(data.maternity?.currentlyPregnant, false);
    assert.strictEqual(data.maternity?.tryingToGetPregnant, false);
    assert.strictEqual(data.maternity?.historyComplications, false);
    assert.strictEqual(data.maternity?.infertilityTreatment, false);
  });
});
