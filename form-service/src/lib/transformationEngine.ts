import jsonata from 'jsonata';

/**
 * Evaluate a JSONata transformation expression
 */
export const evaluateTransformation = async (
  expression: string,
  data: Record<string, unknown>
): Promise<unknown> => {
  if (!expression || expression.trim() === '') {
    return undefined;
  }

  try {
    const expr = jsonata(expression);
    const result = await expr.evaluate(data);
    return result;
  } catch (error) {
    console.error('Error evaluating transformation:', error);
    return undefined;
  }
};

/**
 * Validate a JSONata expression syntax
 */
export const validateTransformation = (expression: string): boolean => {
  if (!expression || expression.trim() === '') {
    return false;
  }

  try {
    jsonata(expression);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Apply multiple transformations to data
 */
export const transformData = async (
  data: Record<string, unknown>,
  transformations: Record<string, string>
): Promise<Record<string, unknown>> => {
  const result: Record<string, unknown> = {};

  for (const [targetField, expression] of Object.entries(transformations)) {
    const value = await evaluateTransformation(expression, data);
    if (value !== undefined) {
      result[targetField] = value;
    }
  }

  return result;
};

/**
 * Apply a single transformation and return the value
 */
export const applySingleTransformation = async (
  expression: string,
  data: Record<string, unknown>
): Promise<unknown> => {
  return evaluateTransformation(expression, data);
};

