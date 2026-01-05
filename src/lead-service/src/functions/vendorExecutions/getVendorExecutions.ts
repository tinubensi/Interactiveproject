/**
 * Get Vendor Executions Function
 * Returns RPA execution diagnostics and errors for a specific lead
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { handlePreflight, withCors } from '../../utils/corsHelper';

export async function getVendorExecutions(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const leadId = request.params.leadId;
    const vendorId = request.query.get('vendorId');
    const executionType = request.query.get('type') as 'diagnostic' | 'error' | null;

    if (!leadId) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'leadId is required'
        }
      });
    }

    let executions;

    if (vendorId) {
      // Filter by specific vendor
      executions = await cosmosService.getVendorExecutionsByVendor(leadId, vendorId);
      context.log(`Retrieved ${executions.length} executions for lead ${leadId}, vendor ${vendorId}`);
    } else if (executionType) {
      // Filter by execution type
      executions = await cosmosService.getVendorExecutionsByType(leadId, executionType);
      context.log(`Retrieved ${executions.length} ${executionType} executions for lead ${leadId}`);
    } else {
      // Get all executions for the lead
      executions = await cosmosService.getVendorExecutionsForLead(leadId);
      context.log(`Retrieved ${executions.length} executions for lead ${leadId}`);
    }

    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        data: executions,
        count: executions.length
      }
    });
  } catch (error: any) {
    context.error('Get vendor executions error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to get vendor executions',
        details: error.message
      }
    });
  }
}

app.http('getVendorExecutions', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'leads/{leadId}/vendor-executions',
  handler: getVendorExecutions
});




