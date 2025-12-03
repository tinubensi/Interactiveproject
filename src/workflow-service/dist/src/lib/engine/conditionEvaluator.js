"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEvaluationContext = exports.findAllMatchingTransitions = exports.findMatchingTransition = exports.evaluateCondition = exports.evaluateSimpleCondition = void 0;
const expressionResolver_1 = require("./expressionResolver");
/**
 * Type guard to check if condition is a simple condition
 */
const isSimpleCondition = (condition) => {
    return 'left' in condition && 'operator' in condition && 'right' in condition;
};
/**
 * Type guard to check if condition is a compound condition
 */
const isCompoundCondition = (condition) => {
    return 'operator' in condition && 'conditions' in condition;
};
/**
 * Type guard to check if condition is a NOT condition
 */
const isNotCondition = (condition) => {
    return 'operator' in condition && condition.operator === 'not' && 'condition' in condition;
};
/**
 * Evaluate a simple condition
 */
const evaluateSimpleCondition = (condition, context) => {
    const leftValue = (0, expressionResolver_1.resolveValue)(condition.left, context);
    const rightValue = condition.right;
    return compareValues(leftValue, rightValue, condition.operator);
};
exports.evaluateSimpleCondition = evaluateSimpleCondition;
/**
 * Compare two values using the specified operator
 */
const compareValues = (left, right, operator) => {
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
            }
            catch {
                return false;
            }
        default:
            return false;
    }
};
/**
 * Evaluate a condition expression (simple, compound, or NOT)
 */
const evaluateCondition = (condition, context) => {
    // Handle NOT condition
    if (isNotCondition(condition)) {
        return !(0, exports.evaluateCondition)(condition.condition, context);
    }
    // Handle compound condition (AND/OR)
    if (isCompoundCondition(condition)) {
        const { operator, conditions } = condition;
        if (operator === 'and') {
            return conditions.every((cond) => (0, exports.evaluateCondition)(cond, context));
        }
        if (operator === 'or') {
            return conditions.some((cond) => (0, exports.evaluateCondition)(cond, context));
        }
        return false;
    }
    // Handle simple condition
    if (isSimpleCondition(condition)) {
        return (0, exports.evaluateSimpleCondition)(condition, context);
    }
    return false;
};
exports.evaluateCondition = evaluateCondition;
/**
 * Find the first matching transition rule
 * Returns the targetStepId of the matching rule, or null if none match
 */
const findMatchingTransition = (transitions, context) => {
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
        if ((0, exports.evaluateCondition)(transition.condition, context)) {
            return transition.targetStepId;
        }
    }
    // If no match found, look for default transition
    const defaultTransition = transitions.find((t) => t.isDefault);
    return defaultTransition?.targetStepId ?? null;
};
exports.findMatchingTransition = findMatchingTransition;
/**
 * Evaluate multiple transition rules and return all matching ones
 * Useful for parallel execution decisions
 */
const findAllMatchingTransitions = (transitions, context) => {
    const matches = [];
    for (const transition of transitions) {
        if (!transition.condition) {
            if (!transition.isDefault) {
                matches.push(transition.targetStepId);
            }
            continue;
        }
        if ((0, exports.evaluateCondition)(transition.condition, context)) {
            matches.push(transition.targetStepId);
        }
    }
    return matches;
};
exports.findAllMatchingTransitions = findAllMatchingTransitions;
/**
 * Create an evaluation context from workflow data
 */
const createEvaluationContext = (variables, stepOutputs = {}, input = {}) => {
    return {
        variables,
        stepOutputs,
        input
    };
};
exports.createEvaluationContext = createEvaluationContext;
//# sourceMappingURL=conditionEvaluator.js.map