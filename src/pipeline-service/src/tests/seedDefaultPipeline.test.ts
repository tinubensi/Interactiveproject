/**
 * Pipeline Service - Default Pipeline Seeder Tests
 * 
 * Tests for the default pipeline generation
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  generateDefaultHealthInsurancePipeline,
  getSeedData,
} from '../data/seedDefaultPipeline';

describe('Default Pipeline Seeder', () => {
  describe('generateDefaultHealthInsurancePipeline', () => {
    it('should generate a valid pipeline', () => {
      const pipeline = generateDefaultHealthInsurancePipeline('test-user');
      
      assert.ok(pipeline.pipelineId, 'Should have a pipeline ID');
      assert.ok(pipeline.name, 'Should have a name');
      assert.strictEqual(pipeline.lineOfBusiness, 'medical', 'Should be for medical LOB');
      assert.strictEqual(pipeline.businessType, 'individual', 'Should be for individual business type');
      assert.strictEqual(pipeline.status, 'draft', 'Should start in draft status');
    });

    it('should have steps array', () => {
      const pipeline = generateDefaultHealthInsurancePipeline('test-user');
      
      assert.ok(Array.isArray(pipeline.steps), 'Steps should be an array');
      assert.ok(pipeline.steps.length > 0, 'Should have at least one step');
    });

    it('should have entry step ID set', () => {
      const pipeline = generateDefaultHealthInsurancePipeline('test-user');
      
      assert.ok(pipeline.entryStepId, 'Should have entry step ID');
      
      const entryStep = pipeline.steps.find(s => s.id === pipeline.entryStepId);
      assert.ok(entryStep, 'Entry step should exist in steps array');
    });

    it('should have required stage steps', () => {
      const pipeline = generateDefaultHealthInsurancePipeline('test-user');
      
      const stageSteps = pipeline.steps.filter(s => s.type === 'stage');
      const stageIds = stageSteps.map(s => s.stageId);
      
      assert.ok(stageIds.includes('lead-created'), 'Should have lead-created stage');
      assert.ok(stageIds.includes('plans-available'), 'Should have plans-available stage');
      assert.ok(stageIds.includes('quotation-created'), 'Should have quotation-created stage');
      assert.ok(stageIds.includes('policy-issued'), 'Should have policy-issued stage');
    });

    it('should have a hot lead decision step', () => {
      const pipeline = generateDefaultHealthInsurancePipeline('test-user');
      
      const decisionSteps = pipeline.steps.filter(s => s.type === 'decision');
      const hotLeadDecision = decisionSteps.find(
        s => s.type === 'decision' && s.conditionType === 'is_hot_lead'
      );
      
      assert.ok(hotLeadDecision, 'Should have hot lead decision step');
    });

    it('should have an optional underwriter approval step', () => {
      const pipeline = generateDefaultHealthInsurancePipeline('test-user');
      
      const approvalSteps = pipeline.steps.filter(s => s.type === 'approval');
      const underwriterApproval = approvalSteps.find(
        s => s.type === 'approval' && s.approverRole === 'underwriter'
      );
      
      assert.ok(underwriterApproval, 'Should have underwriter approval step');
      assert.strictEqual(underwriterApproval?.enabled, false, 'Should be disabled by default');
    });

    it('should have steps with unique IDs', () => {
      const pipeline = generateDefaultHealthInsurancePipeline('test-user');
      
      const stepIds = pipeline.steps.map(s => s.id);
      const uniqueIds = new Set(stepIds);
      
      assert.strictEqual(uniqueIds.size, stepIds.length, 'All step IDs should be unique');
    });

    it('should have steps with sequential order', () => {
      const pipeline = generateDefaultHealthInsurancePipeline('test-user');
      
      const mainSteps = pipeline.steps.filter(s => s.order < 50);
      const orders = mainSteps.map(s => s.order).sort((a, b) => a - b);
      
      for (let i = 1; i < orders.length; i++) {
        assert.ok(orders[i] > orders[i - 1], 'Orders should be sequential');
      }
    });

    it('should set createdBy from parameter', () => {
      const pipeline = generateDefaultHealthInsurancePipeline('custom-user');
      
      assert.strictEqual(pipeline.createdBy, 'custom-user');
    });

    it('should have createdAt timestamp', () => {
      const before = new Date().toISOString();
      const pipeline = generateDefaultHealthInsurancePipeline('test-user');
      const after = new Date().toISOString();
      
      assert.ok(pipeline.createdAt >= before, 'createdAt should be after test started');
      assert.ok(pipeline.createdAt <= after, 'createdAt should be before test ended');
    });
  });

  describe('getSeedData', () => {
    it('should return pipeline and message', () => {
      const result = getSeedData('test-user');
      
      assert.ok(result.pipeline, 'Should have pipeline');
      assert.ok(result.message, 'Should have message');
      assert.ok(result.message.includes('steps'), 'Message should mention steps');
    });

    it('should default to system if no user provided', () => {
      const result = getSeedData();
      
      assert.strictEqual(result.pipeline.createdBy, 'system');
    });
  });
});

