/**
 * Pipeline Service - Predefined Constants Tests
 * 
 * Tests for the predefined constants and helper functions
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

import {
  PREDEFINED_STAGES,
  PREDEFINED_APPROVERS,
  PREDEFINED_CONDITIONS,
  PREDEFINED_NOTIFICATIONS,
  PREDEFINED_WAIT_EVENTS,
  getStageById,
  getStageByTriggerEvent,
  getApproverById,
  getConditionById,
  getNotificationById,
  getWaitEventById,
  getStagesForLOB,
  EVENT_TO_STAGE_MAP,
  PIPELINE_EVENTS,
} from '../constants/predefined';

describe('Predefined Constants', () => {
  describe('PREDEFINED_STAGES', () => {
    it('should have all required stages', () => {
      const stageIds = PREDEFINED_STAGES.map(s => s.id);
      
      assert.ok(stageIds.includes('lead-created'), 'Should have lead-created stage');
      assert.ok(stageIds.includes('plans-fetching'), 'Should have plans-fetching stage');
      assert.ok(stageIds.includes('plans-available'), 'Should have plans-available stage');
      assert.ok(stageIds.includes('quotation-created'), 'Should have quotation-created stage');
      assert.ok(stageIds.includes('policy-issued'), 'Should have policy-issued stage');
    });

    it('should have unique stage IDs', () => {
      const stageIds = PREDEFINED_STAGES.map(s => s.id);
      const uniqueIds = new Set(stageIds);
      assert.strictEqual(uniqueIds.size, stageIds.length, 'All stage IDs should be unique');
    });

    it('should have unique order values for main stages', () => {
      const mainStages = PREDEFINED_STAGES.filter(s => s.order < 50);
      const orders = mainStages.map(s => s.order);
      const uniqueOrders = new Set(orders);
      assert.strictEqual(uniqueOrders.size, orders.length, 'All main stage orders should be unique');
    });

    it('should have all stages applicable for medical LOB', () => {
      const medicalStages = PREDEFINED_STAGES.filter(s => s.applicableFor.includes('medical'));
      assert.ok(medicalStages.length >= 10, 'Should have at least 10 stages for medical');
    });
  });

  describe('PREDEFINED_APPROVERS', () => {
    it('should have all required approver roles', () => {
      const roleIds = PREDEFINED_APPROVERS.map(a => a.id);
      
      assert.ok(roleIds.includes('manager'), 'Should have manager role');
      assert.ok(roleIds.includes('underwriter'), 'Should have underwriter role');
      assert.ok(roleIds.includes('compliance'), 'Should have compliance role');
    });

    it('should have default timeout hours for all approvers', () => {
      for (const approver of PREDEFINED_APPROVERS) {
        assert.ok(approver.defaultTimeoutHours > 0, `${approver.id} should have default timeout hours`);
      }
    });
  });

  describe('PREDEFINED_CONDITIONS', () => {
    it('should have is_hot_lead condition', () => {
      const hotLeadCondition = PREDEFINED_CONDITIONS.find(c => c.id === 'is_hot_lead');
      assert.ok(hotLeadCondition, 'Should have is_hot_lead condition');
      assert.strictEqual(hotLeadCondition?.hasValue, false, 'is_hot_lead should not have a value');
    });

    it('should have lead_value_above_threshold condition with value support', () => {
      const thresholdCondition = PREDEFINED_CONDITIONS.find(c => c.id === 'lead_value_above_threshold');
      assert.ok(thresholdCondition, 'Should have lead_value_above_threshold condition');
      assert.strictEqual(thresholdCondition?.hasValue, true, 'Should have a value');
      assert.strictEqual(thresholdCondition?.valueType, 'number', 'Value type should be number');
    });
  });

  describe('Helper Functions', () => {
    describe('getStageById', () => {
      it('should return stage for valid ID', () => {
        const stage = getStageById('lead-created');
        assert.ok(stage, 'Should find lead-created stage');
        assert.strictEqual(stage?.name, 'Lead Created');
      });

      it('should return undefined for invalid ID', () => {
        const stage = getStageById('invalid-stage' as any);
        assert.strictEqual(stage, undefined);
      });
    });

    describe('getStageByTriggerEvent', () => {
      it('should return stage for valid event', () => {
        const stage = getStageByTriggerEvent('lead.created');
        assert.ok(stage, 'Should find stage for lead.created event');
        assert.strictEqual(stage?.id, 'lead-created');
      });

      it('should return undefined for invalid event', () => {
        const stage = getStageByTriggerEvent('invalid.event');
        assert.strictEqual(stage, undefined);
      });
    });

    describe('getApproverById', () => {
      it('should return approver for valid ID', () => {
        const approver = getApproverById('underwriter');
        assert.ok(approver, 'Should find underwriter approver');
        assert.strictEqual(approver?.name, 'Underwriter');
      });
    });

    describe('getConditionById', () => {
      it('should return condition for valid ID', () => {
        const condition = getConditionById('is_hot_lead');
        assert.ok(condition, 'Should find is_hot_lead condition');
        assert.strictEqual(condition?.name, 'Is Hot Lead?');
      });
    });

    describe('getStagesForLOB', () => {
      it('should return stages for medical LOB', () => {
        const stages = getStagesForLOB('medical');
        assert.ok(stages.length > 0, 'Should have stages for medical');
        for (const stage of stages) {
          assert.ok(stage.applicableFor.includes('medical'), 'All stages should be applicable for medical');
        }
      });
    });
  });

  describe('EVENT_TO_STAGE_MAP', () => {
    it('should have mappings for all trigger events', () => {
      const triggerEvents = PREDEFINED_STAGES
        .filter(s => s.triggerEvent)
        .map(s => s.triggerEvent!);
      
      for (const event of triggerEvents) {
        assert.ok(event in EVENT_TO_STAGE_MAP, `Should have mapping for ${event}`);
      }
    });
  });

  describe('PIPELINE_EVENTS', () => {
    it('should include lead.created event', () => {
      assert.ok(PIPELINE_EVENTS.includes('lead.created'), 'Should include lead.created');
    });

    it('should include quotation events', () => {
      assert.ok(PIPELINE_EVENTS.includes('quotation.created'), 'Should include quotation.created');
      assert.ok(PIPELINE_EVENTS.includes('quotation.approved'), 'Should include quotation.approved');
    });

    it('should include policy events', () => {
      assert.ok(PIPELINE_EVENTS.includes('policy.issued'), 'Should include policy.issued');
    });
  });
});

