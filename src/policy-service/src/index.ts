/**
 * Policy Service
 * Azure Functions Entry Point
 * 
 * This service handles:
 * - Policy issuance requests
 * - Approval/rejection workflow
 * - Issued policy management
 * - Document management
 */

// Import all HTTP functions
import './functions/policyRequests/createPolicyRequest';
import './functions/policyRequests/updateStatus';
import './functions/policyRequests/listPolicyRequests';
import './functions/policies/listPolicies';

// Import all event handlers
import './functions/events/handleQuotationApproved';
import './functions/events/handlePipelineAction';

// Import Durable Functions orchestrator (optional enhancement)
// Uncomment when Durable Functions extension is configured
// import './functions/orchestrators/policyIssuanceOrchestrator';

console.log('Policy Service loaded');


