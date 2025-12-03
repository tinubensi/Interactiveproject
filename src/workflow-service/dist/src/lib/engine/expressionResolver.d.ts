export interface ExpressionContext {
    variables: Record<string, unknown>;
    stepOutputs: Record<string, unknown>;
    input: Record<string, unknown>;
    env?: Record<string, string>;
}
/**
 * Built-in functions available in expressions
 */
export declare const BuiltInFunctions: {
    now: () => string;
    today: () => string;
    dateAdd: (days: number, unit?: 'days' | 'hours' | 'minutes') => string;
    dateDiff: (date1: string, date2: string, unit?: 'days' | 'hours' | 'minutes') => number;
    formatDate: (date: string, format: string) => string;
    uuid: () => string;
    randomInt: (min: number, max: number) => number;
    upper: (str: string) => string;
    lower: (str: string) => string;
    trim: (str: string) => string;
    split: (str: string, separator: string) => string[];
    join: (arr: unknown[], separator: string) => string;
    concat: (...args: unknown[]) => string;
    substring: (str: string, start: number, end?: number) => string;
    replace: (str: string, search: string, replacement: string) => string;
    startsWith: (str: string, prefix: string) => boolean;
    endsWith: (str: string, suffix: string) => boolean;
    contains: (str: string, search: string) => boolean;
    length: (value: unknown) => number;
    sum: (...args: number[]) => number;
    avg: (...args: number[]) => number;
    min: (...args: number[]) => number;
    max: (...args: number[]) => number;
    count: (arr: unknown[]) => number;
    round: (num: number, decimals?: number) => number;
    abs: (num: number) => number;
    default: (value: unknown, defaultValue: unknown) => unknown;
    coalesce: (...args: unknown[]) => unknown;
    ifThen: (condition: boolean, thenValue: unknown, elseValue: unknown) => unknown;
    isNull: (value: unknown) => boolean;
    isNotNull: (value: unknown) => boolean;
    isEmpty: (value: unknown) => boolean;
    stringify: (value: unknown) => string;
    parse: (str: string) => unknown;
    toNumber: (value: unknown) => number;
    toString: (value: unknown) => string;
    toBoolean: (value: unknown) => boolean;
};
/**
 * Resolve a value reference from context
 * Supports:
 * - $.variableName - workflow variable
 * - {{steps.stepId.output}} - step output
 * - {{input.fieldName}} - trigger input
 * - {{env.VAR_NAME}} - environment variable
 * - {{fn.functionName()}} - built-in function
 */
export declare const resolveValue: (expression: string, context: ExpressionContext) => unknown;
/**
 * Resolve a template string with embedded expressions
 * e.g., "Hello, {{$.name}}! Your order {{$.orderId}} is ready."
 */
export declare const resolveTemplate: (template: string, context: ExpressionContext) => string;
/**
 * Resolve all expressions in an object recursively
 */
export declare const resolveObject: (obj: unknown, context: ExpressionContext) => unknown;
/**
 * Resolve an expression and return the result
 * This is the main entry point for expression resolution
 */
export declare const resolveExpression: (expression: string, context: ExpressionContext) => unknown;
/**
 * Create an expression context from workflow execution data
 */
export declare const createExpressionContext: (variables: Record<string, unknown>, stepOutputs: Record<string, unknown>, input: Record<string, unknown>, env?: Record<string, string>) => ExpressionContext;
//# sourceMappingURL=expressionResolver.d.ts.map