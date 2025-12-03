import {
  ConditionExpression,
  SimpleCondition,
  CompoundCondition,
  NotCondition,
  TransitionRule,
  ConditionOperator
} from '../../models/workflowTypes';
import { resolveValue, ExpressionContext } from './expressionResolver';

export type EvaluationContext = ExpressionContext;

/**
 * Type guard to check if condition is a simple condition
 */
const isSimpleCondition = (
  condition: ConditionExpression
): condition is SimpleCondition => {
  return 'left' in condition && 'operator' in condition && 'right' in condition;
};

/**
 * Type guard to check if condition is a compound condition
 */
const isCompoundCondition = (
  condition: ConditionExpression
): condition is CompoundCondition => {
  return 'operator' in condition && 'conditions' in condition;
};

/**
 * Type guard to check if condition is a NOT condition
 */
const isNotCondition = (
  condition: ConditionExpression
): condition is NotCondition => {
  return 'operator' in condition && (condition as NotCondition).operator === 'not' && 'condition' in condition;
};

/**
 * Evaluate a simple condition
 */
export const evaluateSimpleCondition = (
  condition: SimpleCondition,
  context: EvaluationContext
): boolean => {
  const leftValue = resolveValue(condition.left, context);
  const rightValue = condition.right;

  return compareValues(leftValue, rightValue, condition.operator);
};

/**
 * Compare two values using the specified operator
 */
const compareValues = (
  left: unknown,
  right: unknown,
  operator: Exclude<ConditionOperator, 'and' | 'or' | 'not'>
): boolean => {
  switch (operator) {
    case 'eq':
      return left === right;

    case 'neq':
      return left !== right;

    case 'gt':
      return Number(left) > Number(right);

    case 'gte':
      return Number(left) >= Number(right);

    case 'lt':
      return Number(left) < Number(right);

    case 'lte':
      return Number(left) <= Number(right);

    case 'contains':
      if (Array.isArray(left)) {
        return left.includes(right);
      }
      return String(left).includes(String(right));

    case 'startsWith':
      return String(left).startsWith(String(right));

    case 'endsWith':
      return String(left).endsWith(String(right));

    case 'in':
      if (Array.isArray(right)) {
        return right.includes(left);
      }
      return false;

    case 'notIn':
      if (Array.isArray(right)) {
        return !right.includes(left);
      }
      return true;

    case 'exists':
      return left !== undefined && left !== null;

    case 'notExists':
      return left === undefined || left === null;

    case 'regex':
      try {
        const regex = new RegExp(String(right));
        return regex.test(String(left));
      } catch {
        return false;
      }

    default:
      return false;
  }
};

/**
 * Evaluate a condition expression (simple, compound, or NOT)
 */
export const evaluateCondition = (
  condition: ConditionExpression,
  context: EvaluationContext
): boolean => {
  // Handle NOT condition
  if (isNotCondition(condition)) {
    return !evaluateCondition(condition.condition, context);
  }

  // Handle compound condition (AND/OR)
  if (isCompoundCondition(condition)) {
    const { operator, conditions } = condition;

    if (operator === 'and') {
      return conditions.every((cond) => evaluateCondition(cond, context));
    }

    if (operator === 'or') {
      return conditions.some((cond) => evaluateCondition(cond, context));
    }

    return false;
  }

  // Handle simple condition
  if (isSimpleCondition(condition)) {
    return evaluateSimpleCondition(condition, context);
  }

  return false;
};

/**
 * Find the first matching transition rule
 * Returns the targetStepId of the matching rule, or null if none match
 */
export const findMatchingTransition = (
  transitions: TransitionRule[],
  context: EvaluationContext
): string | null => {
  if (!transitions || transitions.length === 0) {
    return null;
  }

  // Sort by priority if specified (lower number = higher priority)
  const sortedTransitions = [...transitions].sort((a, b) => {
    const priorityA = a.priority ?? Number.MAX_SAFE_INTEGER;
    const priorityB = b.priority ?? Number.MAX_SAFE_INTEGER;
    return priorityA - priorityB;
  });

  // Find the first matching transition
  for (const transition of sortedTransitions) {
    // No condition means unconditional match
    if (!transition.condition) {
      if (!transition.isDefault) {
        return transition.targetStepId;
      }
      continue; // Skip defaults in first pass
    }

    // Evaluate the condition
    if (evaluateCondition(transition.condition, context)) {
      return transition.targetStepId;
    }
  }

  // If no match found, look for default transition
  const defaultTransition = transitions.find((t) => t.isDefault);
  return defaultTransition?.targetStepId ?? null;
};

/**
 * Evaluate multiple transition rules and return all matching ones
 * Useful for parallel execution decisions
 */
export const findAllMatchingTransitions = (
  transitions: TransitionRule[],
  context: EvaluationContext
): string[] => {
  const matches: string[] = [];

  for (const transition of transitions) {
    if (!transition.condition) {
      if (!transition.isDefault) {
        matches.push(transition.targetStepId);
      }
      continue;
    }

    if (evaluateCondition(transition.condition, context)) {
      matches.push(transition.targetStepId);
    }
  }

  return matches;
};

/**
 * Create an evaluation context from workflow data
 */
export const createEvaluationContext = (
  variables: Record<string, unknown>,
  stepOutputs: Record<string, unknown> = {},
  input: Record<string, unknown> = {}
): EvaluationContext => {
  return {
    variables,
    stepOutputs,
    input
  };
};

