"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformResultToStepResult = exports.executeTransform = void 0;
const jsonata_1 = __importDefault(require("jsonata"));
/**
 * Execute a JSONata transformation
 */
const executeTransform = async (config, context) => {
    try {
        // Compile the JSONata expression
        const expression = (0, jsonata_1.default)(config.expression);
        // Prepare the input data - make variables available at root level for $. access
        const inputData = {
            ...context.variables,
            $: context.variables,
            steps: context.stepOutputs,
            input: context.input,
            env: process.env
        };
        // Evaluate the expression
        const result = await expression.evaluate(inputData);
        return {
            success: true,
            data: result,
            outputVariable: config.outputVariable
        };
    }
    catch (error) {
        return {
            success: false,
            error: {
                code: 'TRANSFORM_ERROR',
                message: error instanceof Error ? error.message : 'Transform failed',
                details: error instanceof Error ? error.stack : undefined
            }
        };
    }
};
exports.executeTransform = executeTransform;
/**
 * Convert transform result to step result
 */
const transformResultToStepResult = (result) => {
    const variableUpdates = {};
    if (result.success && result.outputVariable && result.data !== undefined) {
        variableUpdates[result.outputVariable] = result.data;
    }
    return {
        success: result.success,
        output: result.data,
        error: result.error,
        shouldTerminate: false,
        variableUpdates: Object.keys(variableUpdates).length > 0 ? variableUpdates : undefined
    };
};
exports.transformResultToStepResult = transformResultToStepResult;
//# sourceMappingURL=transformExecutor.js.map