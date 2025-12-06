/**
 * Pipeline Service
 * Lead Stage Orchestration with Configurable Pipelines
 */

// Pipeline Management Functions
import './functions/pipelines/createPipeline';
import './functions/pipelines/getPipeline';
import './functions/pipelines/listPipelines';
import './functions/pipelines/updatePipeline';
import './functions/pipelines/deletePipeline';
import './functions/pipelines/activatePipeline';
import './functions/pipelines/deactivatePipeline';

// Step Management Functions
import './functions/steps/addStep';
import './functions/steps/updateStep';
import './functions/steps/deleteStep';
import './functions/steps/reorderSteps';

// Instance Functions
import './functions/instances/listInstances';
import './functions/instances/getInstance';
import './functions/instances/getInstanceByLead';
import './functions/instances/getNextStep';

// Approval Functions
import './functions/approvals/listPendingApprovals';
import './functions/approvals/decideApproval';

// Options Functions (for UI dropdowns)
import './functions/options/getStages';
import './functions/options/getApprovers';
import './functions/options/getConditions';
import './functions/options/getNotifications';
import './functions/options/getWaitEvents';

// Event Handlers
import './functions/events/pipelineOrchestrator';

// Export types and utilities
export * from './models/pipeline';
export * from './constants/predefined';

