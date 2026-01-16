import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { handlePreflight, withCors } from '../../utils/corsHelper';
import { Quotation } from '../../models/quotation';

/**
 * Get Quotation History for a Lead
 * GET /api/quotations/history/{leadId}
 * 
 * Returns all quotations for a lead, ordered by version (newest first)
 * Used to display revision history and previously selected plans
 */
export async function getQuotationHistory(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  context.log('Processing get quotation history request');

  try {
    const leadId = request.params.leadId;

    if (!leadId) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Lead ID is required',
        },
      });
    }

    // Query all quotations for this lead
    const querySpec = {
      query: `
        SELECT * FROM c 
        WHERE c.leadId = @leadId 
        AND (NOT IS_DEFINED(c.deletedAt) OR c.deletedAt = null)
        ORDER BY c.version DESC, c.createdAt DESC
      `,
      parameters: [{ name: '@leadId', value: leadId }]
    };

    const { resources: quotations } = await cosmosService['quotationsContainer'].items
      .query(querySpec)
      .fetchAll();

    context.log(`Found ${quotations.length} quotations for lead ${leadId}`);

    // Get plans for each quotation
    const quotationsWithPlans = await Promise.all(
      quotations.map(async (quotation: Quotation) => {
        try {
          const plans = await cosmosService.getQuotationPlans(quotation.id);
          return {
            ...quotation,
            plans: plans || []
          };
        } catch (error) {
          context.warn(`Failed to fetch plans for quotation ${quotation.id}:`, error);
          return {
            ...quotation,
            plans: []
          };
        }
      })
    );

    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        data: quotationsWithPlans,
        count: quotationsWithPlans.length,
      },
    });
  } catch (error: any) {
    context.error('Error fetching quotation history:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to fetch quotation history',
        details: error.message,
      },
    });
  }
}

app.http('getQuotationHistory', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'quotations/history/{leadId}',
  handler: getQuotationHistory,
});
