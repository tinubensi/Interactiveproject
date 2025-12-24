// Verification Script for Deployed Nectaria Services
// Run with: npx tsx scripts/verify_deployed_flow.ts

const LEAD_SERVICE_URL = 'https://lead-service.azurewebsites.net/api';

function generateId() {
    return Math.random().toString(36).substring(2, 10);
}

async function createLead() {
    const customerId = `test-cust-${generateId()}`;
    console.log(`\n🚀 Starting End-to-End Flow Verification`);
    console.log(`Creating lead for customer: ${customerId}`);

    const leadData = {
        customerId: customerId,
        firstName: "Test",
        lastName: "User",
        email: `test.${customerId}@example.com`,
        phone: { number: "+971500000000" },
        emirate: "Dubai",
        lineOfBusiness: "medical",
        businessType: "individual",
        lobData: {
            petName: "Rex",
            petType: "Dog",
            petBirthday: "2020-01-01",
            // Add data needed for quotation service to verify complete flow
            dateOfBirth: "1990-01-01",
            gender: "Male",
            estimatedPremium: 1000,
            coverageAmount: 50000
        }
    };

    const start = Date.now();

    try {
        const response = await fetch(`${LEAD_SERVICE_URL}/leads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(leadData)
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to create lead: ${response.status} ${text}`);
        }

        const result = await response.json();
        const duration = Date.now() - start;
        const leadId = result.data.lead.id;
        const initialStatus = result.data.lead.currentStage;

        console.log(`✅ Lead Created! ID: ${leadId}`);
        console.log(`⏱️  Creation Latency: ${duration}ms`);
        console.log(`📍 Initial Status: ${initialStatus}`);

        return leadId;
    } catch (error) {
        console.error('❌ Error creating lead:', error);
        process.exit(1);
    }
}

async function pollStatus(leadId: string) {
    console.log(`\n👀 Polling for status updates...`);

    let attempts = 0;
    const maxAttempts = 120; // 120 attempts * 1000ms = 120 seconds timeout
    const pollInterval = 1000;

    let currentStatus = '';
    let seenPlansFetching = false;
    let seenPlansAvailable = false;

    const startPoll = Date.now();

    while (attempts < maxAttempts) {
        try {
            const response = await fetch(`${LEAD_SERVICE_URL}/leads/get/${leadId}?lineOfBusiness=medical`);
            if (response.ok) {
                const result = await response.json();
                /* 
                   The getLead API structure could be { data: { lead: ... } } or { lead: ... } 
                   depending on implementation. Let's be safe.
                */
                const lead = result.data?.lead || result.lead || result;
                const newStatus = lead.currentStage;

                if (newStatus !== currentStatus) {
                    const timeElapsed = Date.now() - startPoll;
                    console.log(`[${timeElapsed}ms] Status changed: ${currentStatus || 'None'} -> ${newStatus}`);
                    currentStatus = newStatus;
                }

                if (currentStatus === 'Plans Fetching') seenPlansFetching = true;
                if (currentStatus === 'Plans Available') {
                    seenPlansAvailable = true;
                    console.log(`\n✨ Success! Lead reached "Plans Available" status.`);
                    break;
                }
            }
        } catch (e) {
            console.warn('Poll error:', e);
        }

        await new Promise(r => setTimeout(r, pollInterval));
        attempts++;
    }

    if (seenPlansAvailable) {
        console.log('\n✅ End-to-End Flow Verification PASSED');
        if (!seenPlansFetching) {
            console.log('ℹ️  Note: "Plans Fetching" step was skipped or too fast to catch (this is fine if it reached Available)');
        }
    } else {
        console.error('\n❌ Verification FAILED: Timed out waiting for "Plans Available"');
        console.error(`Final Status: ${currentStatus}`);
        process.exit(1);
    }
}

async function run() {
    const leadId = await createLead();
    if (leadId) {
        await pollStatus(leadId);
    }
}

run();
