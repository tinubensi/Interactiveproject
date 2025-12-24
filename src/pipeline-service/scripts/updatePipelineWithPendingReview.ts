/**
 * Update Pipeline to Add Pending Review Step
 * Updates the existing Individual Health Insurance pipeline to:
 * 1. Add "Pending Review" stage step
 * 2. Update decision step to route to "Pending Review" instead of "Approved"
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables from local.settings.json
const settingsPath = join(__dirname, '../../local.settings.json');
const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
Object.assign(process.env, settings.Values);

import { initializeDatabase, getPipelinesContainer } from '../src/lib/cosmosClient';
import type { PipelineDefinition, StageStep, DecisionStep } from '../src/models/pipeline';

async function updatePipeline(): Promise<void> {
    console.log('🔧 Updating pipeline to add Pending Review step...\n');

    try {
        // Initialize database
        console.log('📦 Initializing database...');
        await initializeDatabase();
        console.log('✅ Database initialized\n');

        // Get the pipelines container
        const container = getPipelinesContainer();

        // Find the existing default pipeline
        const query = {
            query: 'SELECT * FROM c WHERE c.lineOfBusiness = @lob AND c.businessType = @bt AND c.isDefault = true',
            parameters: [
                { name: '@lob', value: 'medical' },
                { name: '@bt', value: 'individual' },
            ],
        };

        const { resources: existing } = await container.items
            .query<PipelineDefinition>(query)
            .fetchAll();

        if (existing.length === 0) {
            console.log('❌ No default pipeline found for medical/individual');
            return;
        }

        const pipeline = existing[0];
        console.log(`📋 Found pipeline: ${pipeline.name} (${pipeline.pipelineId})\n`);

        // Check if Pending Review step already exists
        const hasPendingReview = pipeline.steps.some(step => 
            step.type === 'stage' && (step as StageStep).stageId === 'pending-review'
        );
        if (hasPendingReview) {
            console.log('✅ Pending Review step already exists in pipeline');
            
            // Just verify the decision step routing
            const decisionStep = pipeline.steps.find(step => 
                step.type === 'decision' && 
                step.name === 'Quotation Approved?'
            ) as DecisionStep | undefined;
            
            if (decisionStep) {
                const pendingReviewStep = pipeline.steps.find(step => 
                    step.type === 'stage' && (step as StageStep).stageId === 'pending-review'
                );
                if (decisionStep.trueNextStepId === pendingReviewStep?.id) {
                    console.log('✅ Decision step already routes to Pending Review');
                    console.log('\n🎉 Pipeline is already up to date!');
                    return;
                } else {
                    console.log('⚠️  Decision step does not route to Pending Review - updating...');
                }
            }
        }

        // Find the decision step
        const decisionStepIndex = pipeline.steps.findIndex(step => 
            step.type === 'decision' && 
            step.name === 'Quotation Approved?'
        );

        if (decisionStepIndex === -1) {
            console.log('❌ Could not find "Quotation Approved?" decision step');
            return;
        }

        const decisionStep = pipeline.steps[decisionStepIndex] as DecisionStep;
        console.log(`  📍 Found decision step: ${decisionStep.name} (order: ${decisionStep.order})`);

        // Find the "Approved" step to get its order
        const approvedStepIndex = pipeline.steps.findIndex(step => 
            step.type === 'stage' && 
            step.stageId === 'approved'
        );

        if (approvedStepIndex === -1) {
            console.log('❌ Could not find "Approved" stage step');
            return;
        }

        const approvedStep = pipeline.steps[approvedStepIndex] as StageStep;
        console.log(`  📍 Found approved step: ${approvedStep.name} (order: ${approvedStep.order})`);

        // Create the Pending Review step
        const pendingReviewStepId = hasPendingReview 
            ? pipeline.steps.find(step => 
                step.type === 'stage' && (step as StageStep).stageId === 'pending-review'
            )!.id
            : uuidv4();

        const pendingReviewStep: StageStep = {
            id: pendingReviewStepId,
            order: decisionStep.order + 1, // Insert after decision step
            enabled: true,
            type: 'stage',
            stageId: 'pending-review',
            stageName: 'Pending Review',
            name: 'Pending Review',
            description: 'Customer has selected a plan - awaiting internal review and approval',
            allowedActions: ['APPROVE_QUOTATION', 'REJECT_QUOTATION', 'MANUAL_ADVANCE'],
        };

        // Update step orders: shift all steps after decision step by +1
        const updatedSteps = pipeline.steps.map(step => {
            if (step.order > decisionStep.order && step.id !== pendingReviewStepId) {
                return { ...step, order: step.order + 1 };
            }
            return step;
        });

        // Insert Pending Review step after decision step
        if (!hasPendingReview) {
            updatedSteps.splice(decisionStepIndex + 1, 0, pendingReviewStep);
        } else {
            // Update existing Pending Review step
            const existingIndex = updatedSteps.findIndex(step => step.id === pendingReviewStepId);
            if (existingIndex !== -1) {
                updatedSteps[existingIndex] = pendingReviewStep;
            }
        }

        // Update decision step to route to Pending Review
        const updatedDecisionStep: DecisionStep = {
            ...decisionStep,
            trueNextStepId: pendingReviewStepId,
        };
        updatedSteps[decisionStepIndex] = updatedDecisionStep;

        // Sort steps by order
        updatedSteps.sort((a, b) => a.order - b.order);

        const updatedPipeline: PipelineDefinition = {
            ...pipeline,
            steps: updatedSteps,
            updatedAt: new Date().toISOString(),
            updatedBy: 'update-pending-review-script',
        };

        // Replace the pipeline
        await container.item(pipeline.id, pipeline.lineOfBusiness).replace(updatedPipeline);
        console.log('\n✅ Pipeline updated successfully!\n');

        // Print summary
        console.log('='.repeat(60));
        console.log('Pipeline Update Complete!');
        console.log('='.repeat(60));
        console.log(`\nPipeline: ${updatedPipeline.name}`);
        console.log(`ID: ${updatedPipeline.pipelineId}`);
        console.log(`\nChanges:`);
        console.log(`  ✅ Added/Updated: Pending Review stage step`);
        console.log(`  ✅ Updated: Decision step routes to Pending Review`);
        console.log(`\nSteps (after decision):`);
        updatedSteps
            .filter(s => s.order >= decisionStep.order)
            .slice(0, 5)
            .forEach(step => {
                const status = step.enabled ? '✅' : '⏸️';
                const routing = step.id === pendingReviewStepId ? ' ← Decision routes here' : '';
                console.log(`  ${status} ${step.order}. ${step.name} (${step.type})${routing}`);
            });
        console.log('\n🎉 Done!');

    } catch (error) {
        console.error('\n❌ Error updating pipeline:', error);
        process.exit(1);
    }
}

// Run the update
updatePipeline().then(() => {
    process.exit(0);
}).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});

