"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const conditionEvaluator_1 = require("../lib/engine/conditionEvaluator");
(0, node_test_1.describe)('Condition Evaluator', () => {
    (0, node_test_1.describe)('evaluateSimpleCondition', () => {
        const context = {
            variables: {
                amount: 1500,
                status: 'active',
                name: 'John Doe',
                tags: ['urgent', 'important'],
                customer: {
                    type: 'VIP',
                    age: 35
                },
                nullValue: null,
                emptyString: ''
            },
            stepOutputs: {},
            input: {}
        };
        (0, node_test_1.describe)('equality operators', () => {
            (0, node_test_1.it)('should evaluate eq operator correctly', () => {
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.status', operator: 'eq', right: 'active' }, context), true);
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.amount', operator: 'eq', right: 1500 }, context), true);
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.status', operator: 'eq', right: 'inactive' }, context), false);
            });
            (0, node_test_1.it)('should evaluate neq operator correctly', () => {
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.status', operator: 'neq', right: 'inactive' }, context), true);
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.status', operator: 'neq', right: 'active' }, context), false);
            });
        });
        (0, node_test_1.describe)('comparison operators', () => {
            (0, node_test_1.it)('should evaluate gt operator correctly', () => {
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.amount', operator: 'gt', right: 1000 }, context), true);
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.amount', operator: 'gt', right: 2000 }, context), false);
            });
            (0, node_test_1.it)('should evaluate gte operator correctly', () => {
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.amount', operator: 'gte', right: 1500 }, context), true);
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.amount', operator: 'gte', right: 1501 }, context), false);
            });
            (0, node_test_1.it)('should evaluate lt operator correctly', () => {
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.amount', operator: 'lt', right: 2000 }, context), true);
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.amount', operator: 'lt', right: 1000 }, context), false);
            });
            (0, node_test_1.it)('should evaluate lte operator correctly', () => {
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.amount', operator: 'lte', right: 1500 }, context), true);
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.amount', operator: 'lte', right: 1499 }, context), false);
            });
        });
        (0, node_test_1.describe)('string operators', () => {
            (0, node_test_1.it)('should evaluate contains operator correctly', () => {
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.name', operator: 'contains', right: 'John' }, context), true);
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.name', operator: 'contains', right: 'Jane' }, context), false);
            });
            (0, node_test_1.it)('should evaluate startsWith operator correctly', () => {
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.name', operator: 'startsWith', right: 'John' }, context), true);
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.name', operator: 'startsWith', right: 'Doe' }, context), false);
            });
            (0, node_test_1.it)('should evaluate endsWith operator correctly', () => {
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.name', operator: 'endsWith', right: 'Doe' }, context), true);
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.name', operator: 'endsWith', right: 'John' }, context), false);
            });
        });
        (0, node_test_1.describe)('array operators', () => {
            (0, node_test_1.it)('should evaluate in operator correctly', () => {
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.status', operator: 'in', right: ['active', 'pending'] }, context), true);
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.status', operator: 'in', right: ['inactive', 'pending'] }, context), false);
            });
            (0, node_test_1.it)('should evaluate notIn operator correctly', () => {
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.status', operator: 'notIn', right: ['inactive', 'pending'] }, context), true);
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.status', operator: 'notIn', right: ['active', 'pending'] }, context), false);
            });
            (0, node_test_1.it)('should evaluate contains with array left value', () => {
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.tags', operator: 'contains', right: 'urgent' }, context), true);
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.tags', operator: 'contains', right: 'low-priority' }, context), false);
            });
        });
        (0, node_test_1.describe)('existence operators', () => {
            (0, node_test_1.it)('should evaluate exists operator correctly', () => {
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.status', operator: 'exists', right: true }, context), true);
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.nonExistent', operator: 'exists', right: true }, context), false);
            });
            (0, node_test_1.it)('should evaluate notExists operator correctly', () => {
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.nonExistent', operator: 'notExists', right: true }, context), true);
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.status', operator: 'notExists', right: true }, context), false);
            });
            (0, node_test_1.it)('should treat null values as non-existent for exists', () => {
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.nullValue', operator: 'exists', right: true }, context), false);
            });
        });
        (0, node_test_1.describe)('regex operator', () => {
            (0, node_test_1.it)('should evaluate regex operator correctly', () => {
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.name', operator: 'regex', right: '^John.*' }, context), true);
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.name', operator: 'regex', right: '^Jane.*' }, context), false);
            });
        });
        (0, node_test_1.describe)('nested path resolution', () => {
            (0, node_test_1.it)('should resolve nested object paths', () => {
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.customer.type', operator: 'eq', right: 'VIP' }, context), true);
                node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateSimpleCondition)({ left: '$.customer.age', operator: 'gte', right: 30 }, context), true);
            });
        });
    });
    (0, node_test_1.describe)('evaluateCondition (compound)', () => {
        const context = {
            variables: {
                amount: 1500,
                customerType: 'VIP',
                priority: 'high',
                isUrgent: true
            },
            stepOutputs: {},
            input: {}
        };
        (0, node_test_1.it)('should evaluate AND condition correctly', () => {
            const condition = {
                operator: 'and',
                conditions: [
                    { left: '$.amount', operator: 'gt', right: 1000 },
                    { left: '$.customerType', operator: 'eq', right: 'VIP' }
                ]
            };
            node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateCondition)(condition, context), true);
            const failCondition = {
                operator: 'and',
                conditions: [
                    { left: '$.amount', operator: 'gt', right: 1000 },
                    { left: '$.customerType', operator: 'eq', right: 'Regular' }
                ]
            };
            node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateCondition)(failCondition, context), false);
        });
        (0, node_test_1.it)('should evaluate OR condition correctly', () => {
            const condition = {
                operator: 'or',
                conditions: [
                    { left: '$.priority', operator: 'eq', right: 'high' },
                    { left: '$.isUrgent', operator: 'eq', right: true }
                ]
            };
            node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateCondition)(condition, context), true);
            const partialCondition = {
                operator: 'or',
                conditions: [
                    { left: '$.priority', operator: 'eq', right: 'low' },
                    { left: '$.isUrgent', operator: 'eq', right: true }
                ]
            };
            node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateCondition)(partialCondition, context), true);
            const failCondition = {
                operator: 'or',
                conditions: [
                    { left: '$.priority', operator: 'eq', right: 'low' },
                    { left: '$.isUrgent', operator: 'eq', right: false }
                ]
            };
            node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateCondition)(failCondition, context), false);
        });
        (0, node_test_1.it)('should evaluate NOT condition correctly', () => {
            const condition = {
                operator: 'not',
                condition: { left: '$.customerType', operator: 'eq', right: 'Regular' }
            };
            node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateCondition)(condition, context), true);
            const failCondition = {
                operator: 'not',
                condition: { left: '$.customerType', operator: 'eq', right: 'VIP' }
            };
            node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateCondition)(failCondition, context), false);
        });
        (0, node_test_1.it)('should evaluate nested compound conditions', () => {
            const condition = {
                operator: 'and',
                conditions: [
                    { left: '$.amount', operator: 'gt', right: 1000 },
                    {
                        operator: 'or',
                        conditions: [
                            { left: '$.customerType', operator: 'eq', right: 'VIP' },
                            { left: '$.priority', operator: 'eq', right: 'urgent' }
                        ]
                    }
                ]
            };
            node_assert_1.default.strictEqual((0, conditionEvaluator_1.evaluateCondition)(condition, context), true);
        });
    });
    (0, node_test_1.describe)('findMatchingTransition', () => {
        const context = {
            variables: {
                amount: 1500,
                customerType: 'VIP',
                status: 'approved'
            },
            stepOutputs: {},
            input: {}
        };
        (0, node_test_1.it)('should find first matching transition', () => {
            const transitions = [
                {
                    targetStepId: 'premium-step',
                    condition: { left: '$.amount', operator: 'gt', right: 1000 }
                },
                {
                    targetStepId: 'regular-step',
                    condition: { left: '$.amount', operator: 'lte', right: 1000 }
                },
                {
                    targetStepId: 'default-step',
                    isDefault: true
                }
            ];
            const result = (0, conditionEvaluator_1.findMatchingTransition)(transitions, context);
            node_assert_1.default.strictEqual(result, 'premium-step');
        });
        (0, node_test_1.it)('should return default transition if no conditions match', () => {
            const transitions = [
                {
                    targetStepId: 'step-a',
                    condition: { left: '$.status', operator: 'eq', right: 'rejected' }
                },
                {
                    targetStepId: 'step-b',
                    condition: { left: '$.status', operator: 'eq', right: 'pending' }
                },
                {
                    targetStepId: 'default-step',
                    isDefault: true
                }
            ];
            const result = (0, conditionEvaluator_1.findMatchingTransition)(transitions, context);
            node_assert_1.default.strictEqual(result, 'default-step');
        });
        (0, node_test_1.it)('should return null if no match and no default', () => {
            const transitions = [
                {
                    targetStepId: 'step-a',
                    condition: { left: '$.status', operator: 'eq', right: 'rejected' }
                }
            ];
            const result = (0, conditionEvaluator_1.findMatchingTransition)(transitions, context);
            node_assert_1.default.strictEqual(result, null);
        });
        (0, node_test_1.it)('should respect priority ordering', () => {
            const transitions = [
                {
                    targetStepId: 'low-priority',
                    condition: { left: '$.amount', operator: 'gt', right: 500 },
                    priority: 10
                },
                {
                    targetStepId: 'high-priority',
                    condition: { left: '$.amount', operator: 'gt', right: 1000 },
                    priority: 1
                }
            ];
            const result = (0, conditionEvaluator_1.findMatchingTransition)(transitions, context);
            node_assert_1.default.strictEqual(result, 'high-priority');
        });
        (0, node_test_1.it)('should handle transition without condition as unconditional', () => {
            const transitions = [
                { targetStepId: 'next-step' }
            ];
            const result = (0, conditionEvaluator_1.findMatchingTransition)(transitions, context);
            node_assert_1.default.strictEqual(result, 'next-step');
        });
    });
});
//# sourceMappingURL=conditionEvaluator.test.js.map