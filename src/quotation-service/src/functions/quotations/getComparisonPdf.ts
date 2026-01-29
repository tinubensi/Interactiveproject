/**
 * Get Comparison PDF Function
 * Returns comparison table PDF for a quotation (same structure as frontend comparison tab).
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { pdfService } from '../../services/pdfService';
// import { ensureAuthorized, requirePermission, QUOTATION_PERMISSIONS } from '../../lib/auth';

export async function getComparisonPdf(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    // TODO: Re-enable when staff portal auth is implemented
    // const userContext = await ensureAuthorized(request);
    // await requirePermission(userContext.userId, QUOTATION_PERMISSIONS.QUOTATIONS_READ);

    const id = request.params.id;
    const leadId = request.query.get('leadId');

    if (!id) {
      return {
        status: 400,
        jsonBody: { error: 'Quotation ID is required' },
      };
    }
    if (!leadId) {
      return {
        status: 400,
        jsonBody: { error: 'leadId query parameter is required' },
      };
    }

    const quotation = await cosmosService.getQuotationById(id, leadId);
    if (!quotation) {
      return {
        status: 404,
        jsonBody: { error: 'Quotation not found' },
      };
    }

    const plans = await cosmosService.getQuotationPlans(id);
    if (!plans || plans.length === 0) {
      return {
        status: 404,
        jsonBody: { error: 'No plans found for this quotation' },
      };
    }

    const plansSlice = plans.slice(0, 5);
    const pdfBuffer = await pdfService.generateComparisonPDF(quotation, plansSlice);

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `insurance-proposal-${quotation.referenceId}-${dateStr}.pdf`;

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
      body: pdfBuffer,
    };
  } catch (error: any) {
    context.error('Get comparison PDF error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to generate comparison PDF',
        details: error.message,
      },
    };
  }
}

app.http('getComparisonPdf', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'quotations/{id}/comparison-pdf',
  handler: getComparisonPdf,
});
