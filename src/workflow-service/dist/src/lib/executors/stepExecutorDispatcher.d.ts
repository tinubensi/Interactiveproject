import { WorkflowStep, StepResult, ExecutionContext } from '../../models/workflowTypes';
import { ExpressionContext } from '../engine/expressionResolver';
/**
 * Execute a single workflow step
 */
export declare const executeStep: (step: WorkflowStep, executionContext: ExecutionContext) => Promise<StepResult>;
/**
 * Determine the next step to execute based on transitions
 */
export declare const determineNextStep: (currentStep: WorkflowStep, steps: WorkflowStep[], context: ExpressionContext, stepResult: StepResult) => string | null;
//# sourceMappingURL=stepExecutorDispatcher.d.ts.map