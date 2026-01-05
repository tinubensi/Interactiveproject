const { CosmosClient } = require('@azure/cosmos');

const LEAD_ID = process.argv[2] || '854df52a-36a8-46fa-b6ed-ef7406436724';

async function checkDatabase() {
  const connectionString = process.env.COSMOS_CONNECTION_STRING;
  
  if (!connectionString) {
    console.error('❌ COSMOS_CONNECTION_STRING not set');
    process.exit(1);
  }

  const client = new CosmosClient(connectionString);
  
  console.log('\n' + '='.repeat(70));
  console.log(`DATABASE CHECK FOR LEAD: ${LEAD_ID}`);
  console.log('='.repeat(70) + '\n');

  try {
    // 1. Check Plans
    console.log('1. PLANS IN COSMOS DB');
    console.log('-'.repeat(70));
    const leadDb = client.database('lead-service-db');
    const plansContainer = leadDb.container('plans');
    
    const { resources: plans } = await plansContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.leadId = @leadId',
        parameters: [{ name: '@leadId', value: LEAD_ID }]
      })
      .fetchAll();
    
    if (plans.length > 0) {
      console.log(`✅ PLANS FOUND: ${plans.length} plans`);
      const vendors = {};
      plans.forEach(p => {
        const v = p.vendorId || 'unknown';
        vendors[v] = (vendors[v] || 0) + 1;
      });
      console.log(`\nVendors:`);
      Object.entries(vendors).forEach(([v, c]) => {
        console.log(`   ${v}: ${c} plans`);
      });
      console.log(`\nSample Plans:`);
      plans.slice(0, 5).forEach(p => {
        console.log(`   - ${p.planName} (${p.vendorName}) - Premium: ${p.annualPremium} ${p.currency}`);
        console.log(`     Fetched: ${p.fetchedAt}`);
      });
    } else {
      console.log('❌ NO PLANS FOUND - This confirms plans were never saved');
    }

    // 2. Check Vendor Executions
    console.log('\n2. VENDOR EXECUTION DIAGNOSTICS');
    console.log('-'.repeat(70));
    const vendorExecContainer = leadDb.container('vendorExecutions');
    
    const { resources: executions } = await vendorExecContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.leadId = @leadId ORDER BY c.timestamp DESC',
        parameters: [{ name: '@leadId', value: LEAD_ID }]
      })
      .fetchAll();
    
    if (executions.length > 0) {
      console.log(`✅ FOUND ${executions.length} execution records`);
      executions.forEach(exec => {
        console.log(`\n   Vendor: ${exec.vendorId}`);
        console.log(`   Stage: ${exec.stage}`);
        console.log(`   Status: ${exec.status}`);
        console.log(`   Message: ${exec.message}`);
        console.log(`   Time: ${exec.timestamp}`);
        if (exec.details) {
          console.log(`   Details: ${JSON.stringify(exec.details, null, 2)}`);
        }
        if (exec.error) {
          console.log(`   Error: ${exec.error}`);
        }
      });
    } else {
      console.log('❌ NO EXECUTION DIAGNOSTICS - RPA jobs may not have run or didn\'t save diagnostics');
    }

    // 3. Check Pipeline Instance
    console.log('\n3. PIPELINE INSTANCE');
    console.log('-'.repeat(70));
    try {
      const pipelineDb = client.database('pipeline-db');
      const instancesContainer = pipelineDb.container('instances');
      
      const { resources: instances } = await instancesContainer.items
        .query({
          query: 'SELECT * FROM c WHERE c.leadId = @leadId',
          parameters: [{ name: '@leadId', value: LEAD_ID }]
        })
        .fetchAll();
      
      if (instances.length > 0) {
        const inst = instances[0];
        console.log('✅ PIPELINE INSTANCE FOUND');
        console.log(`   Instance ID: ${inst.id}`);
        console.log(`   Current Stage: ${inst.currentStageName}`);
        console.log(`   Progress: ${inst.progressPercent}%`);
        console.log(`   Waiting For Event: ${inst.waitingForEvent}`);
        console.log(`   Status: ${inst.status}`);
        console.log(`   Pipeline ID: ${inst.pipelineId}`);
        console.log(`   Created: ${inst.createdAt}`);
        console.log(`   Updated: ${inst.updatedAt}`);
      } else {
        console.log('⚠️  NO PIPELINE INSTANCE FOUND');
      }
    } catch (e) {
      console.log(`❌ Error: ${e.message}`);
    }

    // 4. Check Fetch Request
    console.log('\n4. FETCH REQUEST STATUS');
    console.log('-'.repeat(70));
    try {
      const quotDb = client.database('quotation-generation-db');
      const fetchContainer = quotDb.container('fetchRequests');
      
      const { resources: fetchRequests } = await fetchContainer.items
        .query({
          query: 'SELECT * FROM c WHERE c.leadId = @leadId ORDER BY c.createdAt DESC',
          parameters: [{ name: '@leadId', value: LEAD_ID }]
        })
        .fetchAll();
      
      if (fetchRequests.length > 0) {
        const req = fetchRequests[0];
        console.log('✅ FETCH REQUEST FOUND');
        console.log(`   Request ID: ${req.id}`);
        console.log(`   Status: ${req.status}`);
        console.log(`   Total Vendors: ${req.totalVendors}`);
        console.log(`   Successful Vendors: ${JSON.stringify(req.successfulVendors)}`);
        console.log(`   Failed Vendors: ${JSON.stringify(req.failedVendors)}`);
        console.log(`   Total Plans Found: ${req.totalPlansFound}`);
        console.log(`   Created: ${req.createdAt}`);
        console.log(`   Completed: ${req.completedAt || 'Not completed'}`);
      } else {
        console.log('⚠️  NO FETCH REQUEST FOUND');
      }
    } catch (e) {
      console.log(`❌ Error: ${e.message}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('COMPLETE');
    console.log('='.repeat(70) + '\n');
    
  } catch (error) {
    console.error(`❌ Fatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

checkDatabase();
