import { ConditionExpression, SimpleCondition, TransitionRule } from '../../models/workflowTypes';
import { ExpressionContext } from './expressionResolver';
export type EvaluationContext = ExpressionContext;
/**
 * Evaluate a simple condition
 */
export declare const evaluateSimpleCondition: (condition: SimpleCondition, context: EvaluationContext) => boolean;
/**
 * Evaluate a condition expression (simple, compound, or NOT)
 */
export declare const evaluateCondition: (condition: ConditionExpression, context: EvaluationContext) => boolean;
/**
 * Find the first matching transition rule
 * Returns the targetStepId of the matching rule, or null if none match
 */
export declare const findMatchingTransition: (transitions: TransitionRule[], context: EvaluationContext) => string | null;
/**
 * Evaluate multiple transition rules and return all matching ones
 * Useful for parallel execution decisions
 */
export declare const findAllMatchingTransitions: (transitions: TransitionRule[], context: EvaluationContext) => string[];
/**
 * Create an evaluation context from workflow data
 */
export declare const createEvaluationContext: (variables: Record<string, unknown>, stepOutputs?: Record<string, unknown>, input?: Record<string, unknown>) => EvaluationContext;
//# sourceMappingURL=conditionEvaluator.d.ts.map