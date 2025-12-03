"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scriptResultToStepResult = exports.executeScript = void 0;
// Safe globals that scripts can access
const SAFE_GLOBALS = {
    Math,
    Date,
    JSON,
    String,
    Number,
    Boolean,
    Array,
    Object,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI
};
/**
 * Execute a script in a sandboxed environment
 * Note: This is a simplified implementation. For production, consider using
 * a proper sandbox like vm2 or isolated-vm for better security.
 */
const executeScript = async (config, context) => {
    const timeout = config.timeout || 5000;
    try {
        // Build allowed globals
        const allowedGlobals = {};
        const globalNames = config.allowedGlobals || Object.keys(SAFE_GLOBALS);
        for (const name of globalNames) {
            if (name in SAFE_GLOBALS) {
                allowedGlobals[name] = SAFE_GLOBALS[name];
            }
        }
        // Prepare script context
        const scriptContext = {
            $: context.variables,
            input: context.input,
            steps: context.stepOutputs,
            ...allowedGlobals
        };
        // Create a function from the script
        // The script should return a value
        const scriptFunction = new Function(...Object.keys(scriptContext), `
        "use strict";
        ${config.code}
      `);
        // Execute with timeout
        const result = await Promise.race([
            Promise.resolve(scriptFunction(...Object.values(scriptContext))),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Script execution timeout')), timeout))
        ]);
        return {
            success: true,
            data: result
        };
    }
    catch (error) {
        return {
            success: false,
            error: {
                code: 'SCRIPT_ERROR',
                message: error instanceof Error ? error.message : 'Script execution failed',
                details: error instanceof Error ? error.stack : undefined
            }
        };
    }
};
exports.executeScript = executeScript;
/**
 * Convert script result to step result
 */
const scriptResultToStepResult = (result, outputVariable) => {
    const variableUpdates = {};
    if (result.success && outputVariable && result.data !== undefined) {
        variableUpdates[outputVariable] = result.data;
    }
    return {
        success: result.success,
        output: result.data,
        error: result.error,
        shouldTerminate: false,
        variableUpdates: Object.keys(variableUpdates).length > 0 ? variableUpdates : undefined
    };
};
exports.scriptResultToStepResult = scriptResultToStepResult;
//# sourceMappingURL=scriptExecutor.js.map