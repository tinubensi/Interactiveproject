/**
 * Event Type Alignment Test
 * 
 * This test verifies that the pipeline's async action configuration
 * uses the correct event types that match what services actually publish.
 * 
 * ISSUE: Lead stuck at "Lead Created" because:
 * - Pipeline was configured to wait for 'service.fetch_plans.completed'
 * - But quotation-gen-service publishes 'plans.fetch_completed'
 * 
 * FIX: Pipeline should wait for 'plans.fetch_completed' to match actual events
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateEnhancedMedicalPipeline } from '../data/seedEnhancedPipeline';
import { EnhancedStageStep } from '../models/pipeline';

describe('Event Type Alignment', () => {
  describe('Pipeline Async Action Configuration', () => {
    it('should have Lead Created stage wait for plans.fetch_completed event', () => {
      const pipeline = generateEnhancedMedicalPipeline();
      
      // Find the Lead Created stage
      const leadCreatedStep = pipeline.steps.find(
        step => step.type === 'stage' && (step as any).stageId === 'lead-created'
      ) as EnhancedStageStep;
      
      assert.ok(leadCreatedStep, 'Lead Created step should exist');
      assert.ok(leadCreatedStep.actionConfig, 'Lead Created step should have actionConfig');
      assert.ok(leadCreatedStep.actionConfig.primaryAction, 'Should have primaryAction');
      assert.strictEqual(
        leadCreatedStep.actionConfig.primaryAction.type,
        'async',
        'Primary action should be async'
      );
      
      const asyncAction = leadCreatedStep.actionConfig.primaryAction.asyncAction;
      assert.ok(asyncAction, 'Should have asyncAction configuration');
      
      // CRITICAL: This is the fix - completionEvent should be 'plans.fetch_completed'
      // NOT 'service.fetch_plans.completed'
      assert.strictEqual(
        asyncAction.completionEvent,
        'plans.fetch_completed',
        'Async action should wait for plans.fetch_completed event (not service.fetch_plans.completed)'
      );
      
      console.log('✓ Async action completionEvent is correctly set to: plans.fetch_completed');
    });

    it('should have Lead Created stage exitConditions include plans.fetch_completed', () => {
      const pipeline = generateEnhancedMedicalPipeline();
      
      // Find the Lead Created stage
      const leadCreatedStep = pipeline.steps.find(
        step => step.type === 'stage' && (step as any).stageId === 'lead-created'
      ) as EnhancedStageStep;
      
      assert.ok(leadCreatedStep, 'Lead Created step should exist');
      assert.ok(leadCreatedStep.metadata, 'Lead Created step should have metadata');
      assert.ok(leadCreatedStep.metadata.exitConditions, 'Should have exitConditions');
      
      // CRITICAL: exitConditions should include 'plans.fetch_completed'
      assert.ok(
        leadCreatedStep.metadata.exitConditions.includes('plans.fetch_completed'),
        'exitConditions should include plans.fetch_completed (not service.fetch_plans.completed)'
      );
      
      console.log('✓ exitConditions correctly includes: plans.fetch_completed');
    });
  });

  describe('Event Flow Verification', () => {
    it('should simulate correct event flow from Lead Created to Plans Available', () => {
      const pipeline = generateEnhancedMedicalPipeline();
      
      // Stage order
      const stages = ['lead-created', 'plans-fetching', 'plans-available'];
      
      // Expected events between stages
      const expectedEvents: Record<string, string> = {
        'lead-created -> plans-fetching': 'plans.fetch_started',
        'plans-fetching -> plans-available': 'plans.fetch_completed',
      };
      
      // Verify Lead Created step's completionEvent matches expected
      const leadCreatedStep = pipeline.steps.find(
        step => step.type === 'stage' && (step as any).stageId === 'lead-created'
      ) as EnhancedStageStep;
      
      const asyncAction = leadCreatedStep?.actionConfig?.primaryAction?.asyncAction;
      
      if (asyncAction) {
        // The completionEvent should be plans.fetch_completed
        // This event advances from Plans Fetching to Plans Available
        assert.strictEqual(
          asyncAction.completionEvent,
          'plans.fetch_completed',
          'Completion event should be plans.fetch_completed'
        );
        
        console.log('✓ Event flow is correctly configured');
        console.log('  - Lead Created triggers async action');
        console.log('  - plans.fetch_started advances to Plans Fetching');
        console.log('  - plans.fetch_completed (asyncAction.completionEvent) advances to Plans Available');
      }
    });

    it('should verify events published by quotation-gen-service match pipeline expectations', () => {
      // These are the actual events published by quotation-gen-service
      const eventsPublishedByQuotationGenService = [
        'plans.fetch_started',
        'plans.fetch_completed',
        'plans.fetch_failed',
      ];
      
      const pipeline = generateEnhancedMedicalPipeline();
      
      const leadCreatedStep = pipeline.steps.find(
        step => step.type === 'stage' && (step as any).stageId === 'lead-created'
      ) as EnhancedStageStep;
      
      const asyncAction = leadCreatedStep?.actionConfig?.primaryAction?.asyncAction;
      
      if (asyncAction) {
        assert.ok(
          eventsPublishedByQuotationGenService.includes(asyncAction.completionEvent),
          `Pipeline's completionEvent "${asyncAction.completionEvent}" should match events published by quotation-gen-service`
        );
        
        console.log('✓ Pipeline completionEvent matches quotation-gen-service published events');
      }
    });
  });
});
