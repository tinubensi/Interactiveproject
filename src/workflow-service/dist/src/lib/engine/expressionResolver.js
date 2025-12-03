"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExpressionContext = exports.resolveExpression = exports.resolveObject = exports.resolveTemplate = exports.resolveValue = exports.BuiltInFunctions = void 0;
const uuid_1 = require("uuid");
/**
 * Built-in functions available in expressions
 */
exports.BuiltInFunctions = {
    // Date functions
    now: () => new Date().toISOString(),
    today: () => new Date().toISOString().split('T')[0],
    dateAdd: (days, unit = 'days') => {
        const date = new Date();
        switch (unit) {
            case 'days':
                date.setDate(date.getDate() + days);
                break;
            case 'hours':
                date.setHours(date.getHours() + days);
                break;
            case 'minutes':
                date.setMinutes(date.getMinutes() + days);
                break;
        }
        return date.toISOString();
    },
    dateDiff: (date1, date2, unit = 'days') => {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffMs = d2.getTime() - d1.getTime();
        switch (unit) {
            case 'days':
                return Math.floor(diffMs / (1000 * 60 * 60 * 24));
            case 'hours':
                return Math.floor(diffMs / (1000 * 60 * 60));
            case 'minutes':
                return Math.floor(diffMs / (1000 * 60));
            default:
                return diffMs;
        }
    },
    formatDate: (date, format) => {
        const d = new Date(date);
        // Simple format implementation
        return format
            .replace('YYYY', d.getFullYear().toString())
            .replace('MM', (d.getMonth() + 1).toString().padStart(2, '0'))
            .replace('DD', d.getDate().toString().padStart(2, '0'))
            .replace('HH', d.getHours().toString().padStart(2, '0'))
            .replace('mm', d.getMinutes().toString().padStart(2, '0'))
            .replace('ss', d.getSeconds().toString().padStart(2, '0'));
    },
    // ID functions
    uuid: () => (0, uuid_1.v4)(),
    randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    // String functions
    upper: (str) => String(str).toUpperCase(),
    lower: (str) => String(str).toLowerCase(),
    trim: (str) => String(str).trim(),
    split: (str, separator) => String(str).split(separator),
    join: (arr, separator) => arr.map(String).join(separator),
    concat: (...args) => args.map(String).join(''),
    substring: (str, start, end) => String(str).substring(start, end),
    replace: (str, search, replacement) => String(str).replace(search, replacement),
    startsWith: (str, prefix) => String(str).startsWith(prefix),
    endsWith: (str, suffix) => String(str).endsWith(suffix),
    contains: (str, search) => String(str).includes(search),
    length: (value) => {
        if (Array.isArray(value))
            return value.length;
        if (typeof value === 'string')
            return value.length;
        return 0;
    },
    // Math functions
    sum: (...args) => args.reduce((a, b) => a + b, 0),
    avg: (...args) => args.reduce((a, b) => a + b, 0) / args.length,
    min: (...args) => Math.min(...args),
    max: (...args) => Math.max(...args),
    count: (arr) => Array.isArray(arr) ? arr.length : 0,
    round: (num, decimals = 0) => Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals),
    abs: (num) => Math.abs(num),
    // Utility functions
    default: (value, defaultValue) => value !== undefined && value !== null ? value : defaultValue,
    coalesce: (...args) => args.find(arg => arg !== undefined && arg !== null),
    ifThen: (condition, thenValue, elseValue) => condition ? thenValue : elseValue,
    isNull: (value) => value === null || value === undefined,
    isNotNull: (value) => value !== null && value !== undefined,
    isEmpty: (value) => {
        if (value === null || value === undefined)
            return true;
        if (typeof value === 'string')
            return value.length === 0;
        if (Array.isArray(value))
            return value.length === 0;
        if (typeof value === 'object')
            return Object.keys(value).length === 0;
        return false;
    },
    // JSON functions
    stringify: (value) => JSON.stringify(value),
    parse: (str) => JSON.parse(str),
    // Type conversion
    toNumber: (value) => Number(value),
    toString: (value) => String(value),
    toBoolean: (value) => Boolean(value)
};
/**
 * Parse a path like "$.customer.address.city" or "$.items[0].name"
 */
const parsePath = (path) => {
    // Remove the $. prefix if present
    let cleanPath = path.startsWith('$.') ? path.slice(2) : path;
    // Handle array notation: convert items[0] to items.0
    cleanPath = cleanPath.replace(/\[(\d+)\]/g, '.$1');
    return cleanPath.split('.').filter(Boolean);
};
/**
 * Get a value from an object using a path array
 */
const getNestedValue = (obj, pathParts) => {
    let current = obj;
    for (const part of pathParts) {
        if (current === null || current === undefined) {
            return undefined;
        }
        if (typeof current !== 'object') {
            return undefined;
        }
        // Handle numeric array indices
        const index = parseInt(part, 10);
        if (!isNaN(index) && Array.isArray(current)) {
            current = current[index];
        }
        else {
            current = current[part];
        }
    }
    return current;
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
const resolveValue = (expression, context) => {
    // Handle JSONPath-style variable reference
    if (expression.startsWith('$.')) {
        const pathParts = parsePath(expression);
        return getNestedValue(context.variables, pathParts);
    }
    // Handle template expressions
    if (expression.startsWith('{{') && expression.endsWith('}}')) {
        const inner = expression.slice(2, -2).trim();
        return resolveInnerExpression(inner, context);
    }
    // Return literal value
    return expression;
};
exports.resolveValue = resolveValue;
/**
 * Resolve inner expression (without the {{ }} wrapper)
 */
const resolveInnerExpression = (expression, context) => {
    // Handle step output reference: steps.stepId.path
    if (expression.startsWith('steps.')) {
        const parts = expression.slice(6).split('.');
        const stepId = parts[0];
        const stepOutput = context.stepOutputs[stepId];
        if (parts.length === 1) {
            return stepOutput;
        }
        return getNestedValue(stepOutput, parts.slice(1));
    }
    // Handle input reference: input.fieldName
    if (expression.startsWith('input.')) {
        const path = expression.slice(6);
        const pathParts = parsePath('$.' + path);
        return getNestedValue(context.input, pathParts);
    }
    // Handle environment variable: env.VAR_NAME
    if (expression.startsWith('env.')) {
        const varName = expression.slice(4);
        return process.env[varName] || context.env?.[varName];
    }
    // Handle variable reference: $.path
    if (expression.startsWith('$.')) {
        const pathParts = parsePath(expression);
        return getNestedValue(context.variables, pathParts);
    }
    // Handle built-in function: fn.functionName(args)
    if (expression.startsWith('fn.')) {
        return executeBuiltInFunction(expression.slice(3), context);
    }
    return expression;
};
/**
 * Execute a built-in function
 */
const executeBuiltInFunction = (functionCall, context) => {
    // Parse function name and arguments
    const match = functionCall.match(/^(\w+)\((.*)\)$/);
    if (!match) {
        // No-arg function call like "now()"
        const noArgMatch = functionCall.match(/^(\w+)\(\)$/);
        if (noArgMatch) {
            const fnName = noArgMatch[1];
            const fn = exports.BuiltInFunctions[fnName];
            if (typeof fn === 'function') {
                return fn();
            }
        }
        return undefined;
    }
    const [, fnName, argsStr] = match;
    const fn = exports.BuiltInFunctions[fnName];
    if (typeof fn !== 'function') {
        return undefined;
    }
    // Parse arguments
    const args = parseArguments(argsStr, context);
    return fn(...args);
};
/**
 * Parse function arguments, resolving any variable references
 */
const parseArguments = (argsStr, context) => {
    if (!argsStr.trim()) {
        return [];
    }
    const args = [];
    let current = '';
    let inString = false;
    let stringChar = '';
    let depth = 0;
    for (let i = 0; i < argsStr.length; i++) {
        const char = argsStr[i];
        if (!inString && (char === '"' || char === "'")) {
            inString = true;
            stringChar = char;
            current += char;
        }
        else if (inString && char === stringChar) {
            inString = false;
            current += char;
        }
        else if (!inString && char === '(') {
            depth++;
            current += char;
        }
        else if (!inString && char === ')') {
            depth--;
            current += char;
        }
        else if (!inString && depth === 0 && char === ',') {
            args.push(resolveArgument(current.trim(), context));
            current = '';
        }
        else {
            current += char;
        }
    }
    if (current.trim()) {
        args.push(resolveArgument(current.trim(), context));
    }
    return args;
};
/**
 * Resolve a single argument value
 */
const resolveArgument = (arg, context) => {
    // String literal
    if ((arg.startsWith('"') && arg.endsWith('"')) ||
        (arg.startsWith("'") && arg.endsWith("'"))) {
        return arg.slice(1, -1);
    }
    // Number literal
    if (!isNaN(Number(arg))) {
        return Number(arg);
    }
    // Boolean literal
    if (arg === 'true')
        return true;
    if (arg === 'false')
        return false;
    if (arg === 'null')
        return null;
    // Variable reference
    if (arg.startsWith('$.')) {
        return (0, exports.resolveValue)(arg, context);
    }
    return arg;
};
/**
 * Resolve a template string with embedded expressions
 * e.g., "Hello, {{$.name}}! Your order {{$.orderId}} is ready."
 */
const resolveTemplate = (template, context) => {
    return template.replace(/\{\{([^}]+)\}\}/g, (_, expression) => {
        const value = resolveInnerExpression(expression.trim(), context);
        return value !== undefined && value !== null ? String(value) : '';
    });
};
exports.resolveTemplate = resolveTemplate;
/**
 * Resolve all expressions in an object recursively
 */
const resolveObject = (obj, context) => {
    if (typeof obj === 'string') {
        // Check if it's a full expression or a template
        if (obj.startsWith('{{') && obj.endsWith('}}') &&
            obj.indexOf('{{', 2) === -1) {
            // Single expression - preserve type
            return (0, exports.resolveValue)(obj, context);
        }
        // Template string
        if (obj.includes('{{')) {
            return (0, exports.resolveTemplate)(obj, context);
        }
        // JSONPath variable reference
        if (obj.startsWith('$.')) {
            return (0, exports.resolveValue)(obj, context);
        }
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => (0, exports.resolveObject)(item, context));
    }
    if (obj !== null && typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = (0, exports.resolveObject)(value, context);
        }
        return result;
    }
    return obj;
};
exports.resolveObject = resolveObject;
/**
 * Resolve an expression and return the result
 * This is the main entry point for expression resolution
 */
const resolveExpression = (expression, context) => {
    // Handle template expressions
    if (expression.startsWith('{{') && expression.endsWith('}}')) {
        const inner = expression.slice(2, -2).trim();
        return resolveInnerExpression(inner, context);
    }
    // Handle JSONPath-style references
    if (expression.startsWith('$.')) {
        return (0, exports.resolveValue)(expression, context);
    }
    // Return as-is if no expression patterns found
    return expression;
};
exports.resolveExpression = resolveExpression;
/**
 * Create an expression context from workflow execution data
 */
const createExpressionContext = (variables, stepOutputs, input, env) => {
    return {
        variables,
        stepOutputs,
        input,
        env
    };
};
exports.createExpressionContext = createExpressionContext;
//# sourceMappingURL=expressionResolver.js.map