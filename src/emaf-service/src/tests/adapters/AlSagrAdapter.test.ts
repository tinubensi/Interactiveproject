/**
 * Tests for Al Sagr Adapter - Maternity Mapping
 * TDD: RED Phase - Tests written before implementation
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AlSagrAdapter } from '../../adapters/AlSagrAdapter';
import { UnifiedEmafData } from '../../models/canonicalEmafTypes';

describe('Al Sagr Adapter - Maternity Field Mapping', () => {
  const adapter = new AlSagrAdapter();

  describe('toCanonical - Flat to Canonical', () => {
    it('should map maternity fields from flat structure to canonical', () => {
      const flatData = {
        policyHolder_fullName: 'Jane Doe',
        policyHolder_email: 'jane@example.com',
        policyHolder_mobile: '+971501234567',
        maternity_currentlyPregnant: 'yes',
        maternity_q1_memberName: 'Jane Doe',
        maternity_q1_details: '8 weeks pregnant',
        maternity_tryingToGetPregnant: 'no',
        maternity_lastMenstrualPeriod: '2024-01-15',
        maternity_historyComplications: 'yes',
        maternity_q4_memberName: 'Jane Doe',
        maternity_q4_details: 'Previous C-section',
        maternity_infertilityTreatment: 'no',
        maternity_ultrasoundReport: 'Normal single fetus',
      };

      const canonical = adapter.toCanonical(flatData);

      assert.strictEqual(canonical.maternity?.currentlyPregnant, true);
      assert.strictEqual(canonical.maternity?.currentlyPregnantMemberName, 'Jane Doe');
      assert.strictEqual(canonical.maternity?.currentlyPregnantDetails, '8 weeks pregnant');
      assert.strictEqual(canonical.maternity?.tryingToGetPregnant, false);
      assert.strictEqual(canonical.maternity?.lastMenstrualPeriod, '2024-01-15');
      assert.strictEqual(canonical.maternity?.historyComplications, true);
      assert.strictEqual(canonical.maternity?.historyComplicationsMemberName, 'Jane Doe');
      assert.strictEqual(canonical.maternity?.historyComplicationsDetails, 'Previous C-section');
      assert.strictEqual(canonical.maternity?.infertilityTreatment, false);
      assert.strictEqual(canonical.maternity?.ultrasoundReport, 'Normal single fetus');
    });

    it('should map all NO answers correctly', () => {
      const flatData = {
        policyHolder_fullName: 'Jane Doe',
        policyHolder_email: 'jane@example.com',
        policyHolder_mobile: '+971501234567',
        maternity_currentlyPregnant: 'no',
        maternity_tryingToGetPregnant: 'no',
        maternity_historyComplications: 'no',
        maternity_infertilityTreatment: 'no',
      };

      const canonical = adapter.toCanonical(flatData);

      assert.strictEqual(canonical.maternity?.currentlyPregnant, false);
      assert.strictEqual(canonical.maternity?.tryingToGetPregnant, false);
      assert.strictEqual(canonical.maternity?.historyComplications, false);
      assert.strictEqual(canonical.maternity?.infertilityTreatment, false);
    });

    it('should handle missing maternity fields', () => {
      const flatData = {
        policyHolder_fullName: 'Jane Doe',
        policyHolder_email: 'jane@example.com',
        policyHolder_mobile: '+971501234567',
      };

      const canonical = adapter.toCanonical(flatData);

      assert.strictEqual(canonical.maternity, undefined);
    });

    it('should map question 2 fields correctly', () => {
      const flatData = {
        policyHolder_fullName: 'Jane Doe',
        policyHolder_email: 'jane@example.com',
        policyHolder_mobile: '+971501234567',
        maternity_tryingToGetPregnant: 'yes',
        maternity_q2_memberName: 'Jane Doe',
        maternity_q2_details: 'Under treatment',
      };

      const canonical = adapter.toCanonical(flatData);

      assert.strictEqual(canonical.maternity?.tryingToGetPregnant, true);
      assert.strictEqual(canonical.maternity?.tryingToGetPregnantMemberName, 'Jane Doe');
      assert.strictEqual(canonical.maternity?.tryingToGetPregnantDetails, 'Under treatment');
    });

    it('should map question 5 fields correctly', () => {
      const flatData = {
        policyHolder_fullName: 'Jane Doe',
        policyHolder_email: 'jane@example.com',
        policyHolder_mobile: '+971501234567',
        maternity_infertilityTreatment: 'yes',
        maternity_q5_memberName: 'Jane Doe',
        maternity_q5_details: 'IVF treatment',
      };

      const canonical = adapter.toCanonical(flatData);

      assert.strictEqual(canonical.maternity?.infertilityTreatment, true);
      assert.strictEqual(canonical.maternity?.infertilityTreatmentMemberName, 'Jane Doe');
      assert.strictEqual(canonical.maternity?.infertilityTreatmentDetails, 'IVF treatment');
    });
  });

  describe('fromCanonical - Canonical to Flat', () => {
    it('should map maternity fields from canonical to flat structure', () => {
      const canonical: UnifiedEmafData = {
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
          lastMenstrualPeriod: '2024-01-15',
          historyComplications: true,
          historyComplicationsMemberName: 'Jane Doe',
          historyComplicationsDetails: 'Previous C-section',
          infertilityTreatment: false,
          ultrasoundReport: 'Normal single fetus',
        },
      };

      const flat = adapter.fromCanonical(canonical);

      assert.strictEqual(flat.maternity_currentlyPregnant, 'yes');
      assert.strictEqual(flat.maternity_q1_memberName, 'Jane Doe');
      assert.strictEqual(flat.maternity_q1_details, '8 weeks pregnant');
      assert.strictEqual(flat.maternity_tryingToGetPregnant, 'no');
      assert.strictEqual(flat.maternity_lastMenstrualPeriod, '2024-01-15');
      assert.strictEqual(flat.maternity_historyComplications, 'yes');
      assert.strictEqual(flat.maternity_q4_memberName, 'Jane Doe');
      assert.strictEqual(flat.maternity_q4_details, 'Previous C-section');
      assert.strictEqual(flat.maternity_infertilityTreatment, 'no');
      assert.strictEqual(flat.maternity_ultrasoundReport, 'Normal single fetus');
    });

    it('should map all NO answers correctly', () => {
      const canonical: UnifiedEmafData = {
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

      const flat = adapter.fromCanonical(canonical);

      assert.strictEqual(flat.maternity_currentlyPregnant, 'no');
      assert.strictEqual(flat.maternity_tryingToGetPregnant, 'no');
      assert.strictEqual(flat.maternity_historyComplications, 'no');
      assert.strictEqual(flat.maternity_infertilityTreatment, 'no');
    });

    it('should handle missing maternity section', () => {
      const canonical: UnifiedEmafData = {
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
      };

      const flat = adapter.fromCanonical(canonical);

      assert.strictEqual(flat.maternity_currentlyPregnant, undefined);
      assert.strictEqual(flat.maternity_tryingToGetPregnant, undefined);
    });

    it('should map question 2 fields correctly', () => {
      const canonical: UnifiedEmafData = {
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
          tryingToGetPregnant: true,
          tryingToGetPregnantMemberName: 'Jane Doe',
          tryingToGetPregnantDetails: 'Under treatment',
        },
      };

      const flat = adapter.fromCanonical(canonical);

      assert.strictEqual(flat.maternity_tryingToGetPregnant, 'yes');
      assert.strictEqual(flat.maternity_q2_memberName, 'Jane Doe');
      assert.strictEqual(flat.maternity_q2_details, 'Under treatment');
    });

    it('should map question 5 fields correctly', () => {
      const canonical: UnifiedEmafData = {
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
          infertilityTreatment: true,
          infertilityTreatmentMemberName: 'Jane Doe',
          infertilityTreatmentDetails: 'IVF treatment',
        },
      };

      const flat = adapter.fromCanonical(canonical);

      assert.strictEqual(flat.maternity_infertilityTreatment, 'yes');
      assert.strictEqual(flat.maternity_q5_memberName, 'Jane Doe');
      assert.strictEqual(flat.maternity_q5_details, 'IVF treatment');
    });
  });
});
