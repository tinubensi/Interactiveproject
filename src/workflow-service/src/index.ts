// Workflow Management Service
// Export all modules for Azure Functions

// Admin Functions
import './functions/admin/createWorkflow';
import './functions/admin/getWorkflow';
import './functions/admin/updateWorkflow';
import './functions/admin/listWorkflows';
import './functions/admin/activateWorkflow';
import './functions/admin/deactivateWorkflow';
import './functions/admin/deleteWorkflow';
import './functions/admin/cloneWorkflow';
import './functions/admin/getWorkflowVersions';
import './functions/admin/addStep';
import './functions/admin/updateStep';
import './functions/admin/deleteStep';
import './functions/admin/reorderSteps';
import './functions/admin/validateWorkflow';

// Trigger Functions
import './functions/triggers/httpTriggerHandler';

// Instance Functions
import './functions/instances/listInstances';
import './functions/instances/getInstance';
import './functions/instances/cancelInstance';
import './functions/instances/getInstanceLogs';

// Approval Functions
import './functions/approvals/listPendingApprovals';
import './functions/approvals/getApproval';
import './functions/approvals/submitApprovalDecision';
import './functions/approvals/reassignApproval';

// Template Functions
import './functions/templates/listTemplates';
import './functions/templates/getTemplate';
import './functions/templates/createTemplate';
import './functions/templates/updateTemplate';
import './functions/templates/deleteTemplate';
import './functions/templates/createFromTemplate';

// Canvas Functions
import './functions/admin/getCanvas';
import './functions/admin/saveCanvas';

// Analytics Functions
import './functions/analytics/getOverview';
import './functions/analytics/getWorkflowAnalytics';

// SignalR Functions
import './functions/signalr/negotiate';

// Export types and utilities
export * from './models/workflowTypes';
export * from './lib/config';
export * from './lib/cosmosClient';
export * from './lib/validation';
export * from './lib/repositories/workflowRepository';
export * from './lib/repositories/instanceRepository';
export * from './lib/repositories/triggerRepository';
export * from './lib/repositories/approvalRepository';
export * from './lib/utils/httpResponses';
export * from './lib/utils/auth';
export * from './lib/utils/corsHelper';

// Event publishing and telemetry
export * from './lib/eventPublisher';
export * from './lib/telemetry';

// Engine exports
export * from './lib/engine/expressionResolver';
export * from './lib/engine/conditionEvaluator';
export * from './lib/engine/workflowOrchestrator';

// Executor exports
export * from './lib/executors/httpExecutor';
export * from './lib/executors/eventPublishExecutor';
export * from './lib/executors/cosmosExecutor';
export * from './lib/executors/transformExecutor';
export * from './lib/executors/scriptExecutor';
export * from './lib/executors/stepExecutorDispatcher';
