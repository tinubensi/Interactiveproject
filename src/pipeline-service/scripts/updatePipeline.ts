/**
 * Update Existing Pipeline Script with Environment Loading
 * Updates the existing Individual Health Insurance pipeline to disable Hot Lead Decision
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from local.settings.json
const settingsPath = join(__dirname, '../local.settings.json');
const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
Object.assign(process.env, settings.Values);

import { initializeDatabase, getPipelinesContainer } from '../src/lib/cosmosClient';
import type { PipelineDefinition } from '../src/models/pipeline';

async function updatePipeline(): Promise<void> {
    console.log('🔧 Updating existing pipeline...\n');

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

        // Update the Hot Lead Decision and Notification steps to disabled
        const updatedSteps = pipeline.steps.map(step => {
            if (step.name === 'Is Hot Lead?' || step.name === 'Hot Lead Alert') {
                console.log(`  🔧 Disabling step: ${step.name}`);
                return { ...step, enabled: false };
            }
            return step;
        });

        const updatedPipeline: PipelineDefinition = {
            ...pipeline,
            steps: updatedSteps,
            updatedAt: new Date().toISOString(),
            updatedBy: 'update-script',
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
        console.log(`\nDisabled Steps:`);
        updatedSteps
            .filter(s => !s.enabled)
            .forEach(step => {
                console.log(`  ⏸️  ${step.name} (${step.type})`);
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
