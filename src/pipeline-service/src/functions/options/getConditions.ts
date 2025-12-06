/**
 * Get Conditions Options API
 * GET /api/options/conditions
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { PREDEFINED_CONDITIONS } from '../../constants/predefined';
import { handlePreflight, successResponse, errorResponse } from '../../utils/corsHelper';

async function handler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    return successResponse(request, {
      conditions: PREDEFINED_CONDITIONS.map(condition => ({
        id: condition.id,
        name: condition.name,
        description: condition.description,
        icon: condition.icon,
        hasValue: condition.hasValue,
        valueType: condition.valueType,
        valueLabel: condition.valueLabel,
        valuePlaceholder: condition.valuePlaceholder,
      })),
      count: PREDEFINED_CONDITIONS.length,
    });
  } catch (error: any) {
    context.error('Get conditions error:', error);
    return errorResponse(request, error.message || 'Failed to get conditions', 500);
  }
}

app.http('GetConditions', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'options/conditions',
  handler,
});

