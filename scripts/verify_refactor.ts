
// Verification Script for Nectaria Lead Lifecycle Refactor
// Run with: npx tsx scripts/verify_refactor.ts

import assert from 'node:assert';

// ---------------------------------------------------------
// Mocks Setup
// ---------------------------------------------------------

console.log('--- Setting up Mocks ---');

// Mock Event Capture
const publishedEvents: any[] = [];
const httpCalls: any[] = [];

// Mock global fetch
global.fetch = async (url: any, options: any) => {
    console.log(`  [Fetch] ${url}`);
    httpCalls.push({ url: url.toString(), options });
    return {
        ok: true,
        status: 200,
        text: async () => "OK",
        json: async () => ({ success: true })
    } as any;
};

// Mock Cosmos Container
const mockContainer = {
    items: {
        query: () => ({
            fetchAll: async () => ({ resources: [] })
        }),
        create: async (item: any) => ({ resource: item }),
        upsert: async (item: any) => ({ resource: item }),
        read: async () => ({ resource: null })
    },
    item: () => ({
        read: async () => ({ resource: null }),
        replace: async (item: any) => ({ resource: item }),
        delete: async () => ({})
    })
};

// ---------------------------------------------------------
// Service 1: Lead Service Verification
// ---------------------------------------------------------

async function verifyLeadService() {
    console.log('\n=== Verifying Lead Service (createLead) ===');

    // Dynamic imports
    const { createLead } = await import('../src/lead-service/src/functions/leads/createLead');
    const { cosmosService } = await import('../src/lead-service/src/services/cosmosService');
    const { eventGridService } = await import('../src/lead-service/src/services/eventGridService');

    // Monkey-patch Cosmos Methods AND Containers (crucial for referenceGenerator)
    Object.assign(cosmosService, {
        checkRepeatedContact: async () => ({ isEmailRepeated: false, isPhoneRepeated: false }),
        createLead: async (l: any) => ({ ...l, id: 'lead-1' }),
        createTimelineEntry: async () => { },
        // Patch properties for direct access
        leadsContainer: mockContainer,
        timelinesContainer: mockContainer
    });

    // Monkey-patch EventGrid
    Object.assign(eventGridService, {
        publishLeadCreated: async (evt: any) => {
            console.log('  [Event] lead.created published');
            publishedEvents.push({ type: 'lead.created', payload: evt });
        }
    });

    // Construct VALID Request
    const req: any = {
        method: 'POST',
        text: async () => JSON.stringify({
            customerId: 'cust-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            phone: { number: '+1234567890' },
            emirate: 'Dubai',
            lineOfBusiness: 'medical',
            businessType: 'individual',
            lobData: {
                petName: 'Fluffy',
                petType: 'Dog',
                petBirthday: '2020-01-01'
            }
        }),
        headers: new Headers(),
    };

    const context: any = {
        log: (msg: string) => console.log('  [Log]', msg),
        warn: (msg: string) => console.log('  [Warn]', msg),
        error: (msg: string) => console.log('  [Error]', msg),
    };

    const start = Date.now();
    const res: any = await createLead(req, context);
    const duration = Date.now() - start;

    // Assertions
    assert.equal(res.status, 201, 'Response status should be 201');
    assert.ok(duration < 1000, `Execution too slow: ${duration}ms (Expected < 1000ms)`);
    assert.equal(publishedEvents.length, 1, 'Event should be published');
    assert.equal(publishedEvents[0].type, 'lead.created', 'Event type mismatch');

    console.log(`✅ Lead creation verified! Duration: ${duration}ms`);
}

// ---------------------------------------------------------
// Service 2: Quotation Service Verification
// ---------------------------------------------------------

async function verifyQuotationService() {
    console.log('\n=== Verifying Quotation Service (fetchPlans) ===');

    // Reset mocks
    publishedEvents.length = 0;
    httpCalls.length = 0;

    const { fetchPlans } = await import('../src/quotation-generation-service/src/functions/plans/fetchPlans');
    const { cosmosService } = await import('../src/quotation-generation-service/src/services/cosmosService');
    const { eventGridService } = await import('../src/quotation-generation-service/src/services/eventGridService');
    const { planFetchingService } = await import('../src/quotation-generation-service/src/services/planFetchingService');

    // Monkey-patch Cosmos
    Object.assign(cosmosService, {
        getPlansForLead: async () => [],
        createFetchRequest: async () => { },
        getVendorsByLOB: async () => ['vendor1'],
        createPlans: async () => { },
        updatePlan: async () => { },
        updateFetchRequest: async () => { },
        // Patch properties just in case
        plansContainer: mockContainer,
        fetchRequestsContainer: mockContainer,
        vendorsContainer: mockContainer
    });

    // Monkey-patch PlanFetch
    Object.assign(planFetchingService, {
        fetchPlansForLead: async () => {
            // Simulate a small delay for fetching from vendors (e.g. 100ms)
            await new Promise(r => setTimeout(r, 100));
            return { plans: [{}], successfulVendors: ['v1'], failedVendors: [] };
        },
        calculateRecommendedPlan: () => ({ id: 'plan-1' })
    });

    // Monkey-patch EventGrid
    Object.assign(eventGridService, {
        publishPlansFetchStarted: async () => {
            console.log('  [Event] plans.fetch_started published');
            publishedEvents.push({ type: 'plans.fetch_started' });
        },
        publishPlansFetchCompleted: async () => {
            console.log('  [Event] plans.fetch_completed published');
            publishedEvents.push({ type: 'plans.fetch_completed' });
        }
    });

    // Construct Request
    const req: any = {
        method: 'POST',
        json: async () => ({
            leadId: 'lead-1',
            lineOfBusiness: 'medical',
            businessType: 'individual',
            leadData: {}
        }),
        headers: new Headers(),
    };
    req.headers.set('x-service-key', process.env.INTERNAL_SERVICE_KEY || 'mock-key');

    const context: any = {
        log: (msg: string) => console.log('  [Log]', msg),
        warn: (msg: string) => console.log('  [Warn]', msg),
        error: (msg: string) => console.log('  [Error]', msg),
    };

    const start = Date.now();
    const res: any = await fetchPlans(req, context);
    const duration = Date.now() - start;

    // Assertions
    assert.equal(res.status, 200, 'Response status should be 200');
    assert.ok(duration < 2000, `Execution too slow: ${duration}ms (Expected < 2000ms). Indicates potential blocking sleep.`);

    const completedEvent = publishedEvents.find(e => e.type === 'plans.fetch_completed');
    assert.ok(completedEvent, 'plans.fetch_completed event should be published');

    // Verify HTTP fallback calls
    const hasFallbackCalls = httpCalls.some(c => c.url.includes('pipeline') || c.url.includes('process-event'));
    if (process.env.PIPELINE_SERVICE_URL) {
        assert.ok(hasFallbackCalls, 'Should attempt HTTP fallback to pipeline service');
    }

    console.log(`✅ Plan fetching verified! Duration: ${duration}ms`);
}

// ---------------------------------------------------------
// Main
// ---------------------------------------------------------

async function run() {
    try {
        await verifyLeadService();
        await verifyQuotationService();
        console.log('\n🎉 ALL VERIFICATIONS PASSED');
    } catch (err) {
        console.error('\n❌ VERIFICATION FAILED:', err);
        process.exit(1);
    }
}

run();
