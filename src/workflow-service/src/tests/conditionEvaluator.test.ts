import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  evaluateCondition,
  evaluateSimpleCondition,
  findMatchingTransition,
  EvaluationContext
} from '../lib/engine/conditionEvaluator';
import {
  SimpleCondition,
  CompoundCondition,
  TransitionRule,
  ConditionExpression
} from '../models/workflowTypes';

describe('Condition Evaluator', () => {
  describe('evaluateSimpleCondition', () => {
    const context: EvaluationContext = {
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

    describe('equality operators', () => {
      it('should evaluate eq operator correctly', () => {
        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.status', operator: 'eq', right: 'active' },
            context
          ),
          true
        );

        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.amount', operator: 'eq', right: 1500 },
            context
          ),
          true
        );

        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.status', operator: 'eq', right: 'inactive' },
            context
          ),
          false
        );
      });

      it('should evaluate neq operator correctly', () => {
        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.status', operator: 'neq', right: 'inactive' },
            context
          ),
          true
        );

        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.status', operator: 'neq', right: 'active' },
            context
          ),
          false
        );
      });
    });

    describe('comparison operators', () => {
      it('should evaluate gt operator correctly', () => {
        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.amount', operator: 'gt', right: 1000 },
            context
          ),
          true
        );

        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.amount', operator: 'gt', right: 2000 },
            context
          ),
          false
        );
      });

      it('should evaluate gte operator correctly', () => {
        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.amount', operator: 'gte', right: 1500 },
            context
          ),
          true
        );

        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.amount', operator: 'gte', right: 1501 },
            context
          ),
          false
        );
      });

      it('should evaluate lt operator correctly', () => {
        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.amount', operator: 'lt', right: 2000 },
            context
          ),
          true
        );

        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.amount', operator: 'lt', right: 1000 },
            context
          ),
          false
        );
      });

      it('should evaluate lte operator correctly', () => {
        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.amount', operator: 'lte', right: 1500 },
            context
          ),
          true
        );

        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.amount', operator: 'lte', right: 1499 },
            context
          ),
          false
        );
      });
    });

    describe('string operators', () => {
      it('should evaluate contains operator correctly', () => {
        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.name', operator: 'contains', right: 'John' },
            context
          ),
          true
        );

        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.name', operator: 'contains', right: 'Jane' },
            context
          ),
          false
        );
      });

      it('should evaluate startsWith operator correctly', () => {
        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.name', operator: 'startsWith', right: 'John' },
            context
          ),
          true
        );

        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.name', operator: 'startsWith', right: 'Doe' },
            context
          ),
          false
        );
      });

      it('should evaluate endsWith operator correctly', () => {
        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.name', operator: 'endsWith', right: 'Doe' },
            context
          ),
          true
        );

        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.name', operator: 'endsWith', right: 'John' },
            context
          ),
          false
        );
      });
    });

    describe('array operators', () => {
      it('should evaluate in operator correctly', () => {
        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.status', operator: 'in', right: ['active', 'pending'] },
            context
          ),
          true
        );

        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.status', operator: 'in', right: ['inactive', 'pending'] },
            context
          ),
          false
        );
      });

      it('should evaluate notIn operator correctly', () => {
        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.status', operator: 'notIn', right: ['inactive', 'pending'] },
            context
          ),
          true
        );

        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.status', operator: 'notIn', right: ['active', 'pending'] },
            context
          ),
          false
        );
      });

      it('should evaluate contains with array left value', () => {
        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.tags', operator: 'contains', right: 'urgent' },
            context
          ),
          true
        );

        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.tags', operator: 'contains', right: 'low-priority' },
            context
          ),
          false
        );
      });
    });

    describe('existence operators', () => {
      it('should evaluate exists operator correctly', () => {
        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.status', operator: 'exists', right: true },
            context
          ),
          true
        );

        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.nonExistent', operator: 'exists', right: true },
            context
          ),
          false
        );
      });

      it('should evaluate notExists operator correctly', () => {
        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.nonExistent', operator: 'notExists', right: true },
            context
          ),
          true
        );

        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.status', operator: 'notExists', right: true },
            context
          ),
          false
        );
      });

      it('should treat null values as non-existent for exists', () => {
        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.nullValue', operator: 'exists', right: true },
            context
          ),
          false
        );
      });
    });

    describe('regex operator', () => {
      it('should evaluate regex operator correctly', () => {
        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.name', operator: 'regex', right: '^John.*' },
            context
          ),
          true
        );

        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.name', operator: 'regex', right: '^Jane.*' },
            context
          ),
          false
        );
      });
    });

    describe('nested path resolution', () => {
      it('should resolve nested object paths', () => {
        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.customer.type', operator: 'eq', right: 'VIP' },
            context
          ),
          true
        );

        assert.strictEqual(
          evaluateSimpleCondition(
            { left: '$.customer.age', operator: 'gte', right: 30 },
            context
          ),
          true
        );
      });
    });
  });

  describe('evaluateCondition (compound)', () => {
    const context: EvaluationContext = {
      variables: {
        amount: 1500,
        customerType: 'VIP',
        priority: 'high',
        isUrgent: true
      },
      stepOutputs: {},
      input: {}
    };

    it('should evaluate AND condition correctly', () => {
      const condition: CompoundCondition = {
        operator: 'and',
        conditions: [
          { left: '$.amount', operator: 'gt', right: 1000 },
          { left: '$.customerType', operator: 'eq', right: 'VIP' }
        ]
      };

      assert.strictEqual(evaluateCondition(condition, context), true);

      const failCondition: CompoundCondition = {
        operator: 'and',
        conditions: [
          { left: '$.amount', operator: 'gt', right: 1000 },
          { left: '$.customerType', operator: 'eq', right: 'Regular' }
        ]
      };

      assert.strictEqual(evaluateCondition(failCondition, context), false);
    });

    it('should evaluate OR condition correctly', () => {
      const condition: CompoundCondition = {
        operator: 'or',
        conditions: [
          { left: '$.priority', operator: 'eq', right: 'high' },
          { left: '$.isUrgent', operator: 'eq', right: true }
        ]
      };

      assert.strictEqual(evaluateCondition(condition, context), true);

      const partialCondition: CompoundCondition = {
        operator: 'or',
        conditions: [
          { left: '$.priority', operator: 'eq', right: 'low' },
          { left: '$.isUrgent', operator: 'eq', right: true }
        ]
      };

      assert.strictEqual(evaluateCondition(partialCondition, context), true);

      const failCondition: CompoundCondition = {
        operator: 'or',
        conditions: [
          { left: '$.priority', operator: 'eq', right: 'low' },
          { left: '$.isUrgent', operator: 'eq', right: false }
        ]
      };

      assert.strictEqual(evaluateCondition(failCondition, context), false);
    });

    it('should evaluate NOT condition correctly', () => {
      const condition: ConditionExpression = {
        operator: 'not',
        condition: { left: '$.customerType', operator: 'eq', right: 'Regular' }
      };

      assert.strictEqual(evaluateCondition(condition, context), true);

      const failCondition: ConditionExpression = {
        operator: 'not',
        condition: { left: '$.customerType', operator: 'eq', right: 'VIP' }
      };

      assert.strictEqual(evaluateCondition(failCondition, context), false);
    });

    it('should evaluate nested compound conditions', () => {
      const condition: CompoundCondition = {
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

      assert.strictEqual(evaluateCondition(condition, context), true);
    });
  });

  describe('findMatchingTransition', () => {
    const context: EvaluationContext = {
      variables: {
        amount: 1500,
        customerType: 'VIP',
        status: 'approved'
      },
      stepOutputs: {},
      input: {}
    };

    it('should find first matching transition', () => {
      const transitions: TransitionRule[] = [
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

      const result = findMatchingTransition(transitions, context);
      assert.strictEqual(result, 'premium-step');
    });

    it('should return default transition if no conditions match', () => {
      const transitions: TransitionRule[] = [
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

      const result = findMatchingTransition(transitions, context);
      assert.strictEqual(result, 'default-step');
    });

    it('should return null if no match and no default', () => {
      const transitions: TransitionRule[] = [
        {
          targetStepId: 'step-a',
          condition: { left: '$.status', operator: 'eq', right: 'rejected' }
        }
      ];

      const result = findMatchingTransition(transitions, context);
      assert.strictEqual(result, null);
    });

    it('should respect priority ordering', () => {
      const transitions: TransitionRule[] = [
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

      const result = findMatchingTransition(transitions, context);
      assert.strictEqual(result, 'high-priority');
    });

    it('should handle transition without condition as unconditional', () => {
      const transitions: TransitionRule[] = [
        { targetStepId: 'next-step' }
      ];

      const result = findMatchingTransition(transitions, context);
      assert.strictEqual(result, 'next-step');
    });
  });
});

