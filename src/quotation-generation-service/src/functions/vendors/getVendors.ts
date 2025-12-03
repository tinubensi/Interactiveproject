/**
 * Get Vendors Function
 * Retrieves vendors by LOB or all vendors
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';

export async function getVendors(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const lineOfBusiness = request.query.get('lineOfBusiness');

    let vendors;
    if (lineOfBusiness) {
      vendors = await cosmosService.getVendorsByLOB(lineOfBusiness);
      context.log(`Retrieved ${vendors.length} vendors for ${lineOfBusiness}`);
    } else {
      vendors = await cosmosService.getAllVendors();
      context.log(`Retrieved ${vendors.length} vendors`);
    }

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          vendors
        }
      }
    };
  } catch (error: any) {
    context.error('Get vendors error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to retrieve vendors',
        details: error.message
      }
    };
  }
}

app.http('getVendors', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'vendors',
  handler: getVendors
});


