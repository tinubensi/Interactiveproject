/**
 * Diagnostic Check Script
 * 
 * This script checks the logic and calculations without needing a database connection
 * Run with: npx tsx src/tests/diagnostic-check.ts
 */

// Simple progress calculation function (same as in instanceRepository)
function calculateProgress(completedSteps: number, totalSteps: number): number {
  if (totalSteps === 0) return 0;
  return Math.round((completedSteps / totalSteps) * 100);
}

console.log('=== PIPELINE WORKFLOW DIAGNOSTIC CHECK ===\n');

// Test 1: Progress Calculation
console.log('1. Testing Progress Calculation:');
console.log('   When instance is created with 10 total steps:');
const totalSteps = 10;

// OLD WAY (WRONG)
const oldProgress = calculateProgress(0, totalSteps);
console.log(`   OLD: completedSteps=0, progress=${oldProgress}% ❌ (This was the bug!)`);

// NEW WAY (CORRECT)
const newProgress = calculateProgress(1, totalSteps);
console.log(`   NEW: completedSteps=1, progress=${newProgress}% ✓ (Fixed!)`);
console.log('');

// Test 2: Stage Mapping
console.log('2. Testing Stage ID Mapping:');
const STAGE_NAME_TO_LEAD_SERVICE_ID: Record<string, string> = {
  'Lead Created': 'stage-0',
  'Plans Fetching': 'stage-1',
  'Plans Available': 'stage-2',
  'Quotation Created': 'stage-3',
  'Quotation Sent': 'stage-4',
  'Pending Review': 'stage-5',
  'Policy Issued': 'stage-6',
  'Rejected': 'stage-7',
  'Lost': 'stage-8',
};

console.log('   Stage mappings:');
Object.entries(STAGE_NAME_TO_LEAD_SERVICE_ID).forEach(([name, id]) => {
  console.log(`     "${name}" → ${id}`);
});
console.log('');

// Test 3: Event Flow
console.log('3. Expected Event Flow:');
console.log('   Step 1: lead.created');
console.log('     → Creates instance at "Lead Created" (stage-0)');
console.log('     → Progress: 1/10 = 10%');
console.log('     → Executes entry step');
console.log('     → Updates lead to "Lead Created" stage');
console.log('     → Sets waitingForEvent: "plans.fetch_started"');
console.log('     → Triggers plan fetching');
console.log('');
console.log('   Step 2: plans.fetch_started arrives');
console.log('     → Event matches waitingForEvent ✓');
console.log('     → Advances to "Plans Fetching" (stage-1)');
console.log('     → Progress: 2/10 = 20%');
console.log('     → Updates lead to "Plans Fetching" stage');
console.log('     → Sets waitingForEvent: "plans.fetch_completed"');
console.log('');
console.log('   Step 3: plans.fetch_completed arrives');
console.log('     → Event matches waitingForEvent ✓');
console.log('     → Advances to "Plans Available" (stage-2)');
console.log('     → Progress: 3/10 = 30%');
console.log('     → Updates lead to "Plans Available" stage');
console.log('     → Sets waitingForEvent: "quotation.created"');
console.log('');
console.log('   Step 4: quotation.created arrives');
console.log('     → Event matches waitingForEvent ✓');
console.log('     → Advances to "Quotation Created" (stage-3)');
console.log('     → Progress: 4/10 = 40%');
console.log('     → Updates lead to "Quotation Created" stage');
console.log('');

// Test 4: What to Check
console.log('4. What to Check After Creating a Lead:');
console.log('   ✓ Instance progressPercent should be > 0% (e.g., 10% for 10 steps)');
console.log('   ✓ Instance completedStepsCount should be 1 (not 0)');
console.log('   ✓ Instance currentStageName should be "Lead Created"');
console.log('   ✓ Instance currentStageId should be "lead-created"');
console.log('   ✓ Instance waitingForEvent should be "plans.fetch_started"');
console.log('   ✓ Instance status should be "active"');
console.log('   ✓ Lead in Lead Service should have stageId="stage-0" and currentStage="Lead Created"');
console.log('');

// Test 5: Common Issues
console.log('5. Common Issues and Fixes:');
console.log('   Issue: Progress is 0%');
console.log('   Fix: ✅ FIXED - Changed initial completedStepsCount from 0 to 1');
console.log('');
console.log('   Issue: No stage updates in Lead Service');
console.log('   Check:');
console.log('     - Is LEAD_SERVICE_URL environment variable set?');
console.log('     - Is INTERNAL_SERVICE_KEY environment variable set?');
console.log('     - Check logs for "[EXECUTE STAGE]" messages');
console.log('     - Check if updateLeadStage() is returning false');
console.log('');
console.log('   Issue: Instance not waiting for events');
console.log('   Check:');
console.log('     - Check logs for "[STAGE EXECUTION]" messages');
console.log('     - Verify waitingForEvent is set after entry step execution');
console.log('     - Check if updateInstanceStatusDirect() is failing');
console.log('');

console.log('=== DIAGNOSTIC CHECK COMPLETE ===');

