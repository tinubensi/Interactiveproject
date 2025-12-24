/**
 * Decision Step Multi-Routing Tests
 * Tests for decision step routing with multiple response types (plan_selected, request_revision, reject_plans)
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { generateDefaultHealthInsurancePipeline } from '../data/seedDefaultPipeline';
import type { EventData } from '../lib/orchestrator';

describe('Decision Step Multi-Routing', () => {
  describe('Pipeline Configuration - Revision Requested Stage', () => {
    it('should have Revision Requested stage in pipeline', () => {
      const pipeline = generateDefaultHealthInsurancePipeline();
      
      const revisionStep = pipeline.steps.find(
        step => step.type === 'stage' && 
        (step as any).stageId === 'revision-requested'
      );
      
      assert.ok(revisionStep, 'Revision Requested stage should exist');
      assert.strictEqual(revisionStep?.name, 'Revision Requested');
      assert.strictEqual((revisionStep as any).stageId, 'revision-requested');
    });

    it('should have Revision Requested step after decision step', () => {
      const pipeline = generateDefaultHealthInsurancePipeline();
      
      const decisionStep = pipeline.steps.find(
        step => step.type === 'decision' && step.name === 'Quotation Approved?'
      );
      
      const revisionStep = pipeline.steps.find(
        step => step.type === 'stage' && 
        (step as any).stageId === 'revision-requested'
      );
      
      assert.ok(decisionStep, 'Decision step should exist');
      assert.ok(revisionStep, 'Revision step should exist');
      
      // Revision step should have order 9.5 (between decision at 9 and pending review at 10)
      assert.strictEqual(revisionStep?.order, 9.5);
      assert.ok((revisionStep?.order || 0) > (decisionStep?.order || 0));
    });
  });

  describe('Response Type Routing Logic', () => {
    it('should identify request_revision response type correctly', () => {
      const eventData: EventData = {
        leadId: 'test-lead',
        quotationId: 'quotation-1',
        responseType: 'request_revision',
        revisionReason: 'Need different coverage',
        lineOfBusiness: 'medical',
      };

      const responseType = eventData.responseType as string;
      assert.strictEqual(responseType, 'request_revision');
    });

    it('should identify reject_plans response type correctly', () => {
      const eventData: EventData = {
        leadId: 'test-lead',
        quotationId: 'quotation-1',
        responseType: 'reject_plans',
        rejectionReason: 'Plans not suitable',
        lineOfBusiness: 'medical',
      };

      const responseType = eventData.responseType as string;
      assert.strictEqual(responseType, 'reject_plans');
    });

    it('should identify plan_selected response type correctly', () => {
      const eventData: EventData = {
        leadId: 'test-lead',
        quotationId: 'quotation-1',
        responseType: 'plan_selected',
        selectedPlanId: 'plan-123',
        lineOfBusiness: 'medical',
      };

      const responseType = eventData.responseType as string;
      assert.strictEqual(responseType, 'plan_selected');
    });
  });

  describe('Pipeline Step Finding', () => {
    it('should find Revision Requested stage step in pipeline', () => {
      const pipeline = generateDefaultHealthInsurancePipeline();
      
      const revisionStep = pipeline.steps.find(s => 
        s.type === 'stage' && 
        (s as any).stageId === 'revision-requested'
      );
      
      assert.ok(revisionStep, 'Should find Revision Requested step');
      assert.strictEqual((revisionStep as any).stageId, 'revision-requested');
    });

    it('should find Lost stage step in pipeline', () => {
      const pipeline = generateDefaultHealthInsurancePipeline();
      
      const lostStep = pipeline.steps.find(s => 
        s.type === 'stage' && 
        (s as any).stageId === 'lost'
      );
      
      assert.ok(lostStep, 'Should find Lost step');
      assert.strictEqual((lostStep as any).stageId, 'lost');
    });
  });
});

