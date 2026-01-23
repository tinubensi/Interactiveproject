import { InvocationContext } from '@azure/functions';

export interface CreateEmafSubmissionRequest {
  leadId: string;
  quotationId: string;
  customerName: string;
  customerEmail: string;
  selectedPlanId: string;
  vendorId: string;
  vendorName: string;
}

export interface EmafSubmissionResponse {
  success: boolean;
  token: string;
  emafUrl: string;
}

class EmafService {
  private emafServiceUrl: string;
  private serviceKey: string;

  constructor() {
    // EMAF service is deployed as Azure Function App
    this.emafServiceUrl = process.env.EMAF_SERVICE_URL || 'https://emaf-service-func.azurewebsites.net/api';
    // Updated default to ensure both services use the same key
    this.serviceKey = process.env.SERVICE_KEY || 'nectaria-internal-2026';
  }

  /**
   * Create an EMAF submission for a customer
   */
  async createEmafSubmission(
    data: CreateEmafSubmissionRequest,
    context: InvocationContext
  ): Promise<EmafSubmissionResponse> {
    try {
      context.log('Creating EMAF submission for:', {
        leadId: data.leadId,
        quotationId: data.quotationId,
        vendorId: data.vendorId,
      });

      const response = await fetch(`${this.emafServiceUrl}/internal/submissions/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-key': this.serviceKey,
        },
        body: JSON.stringify({
          leadId: data.leadId,
          quotationId: data.quotationId,
          vendorId: data.vendorId,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          selectedPlanId: data.selectedPlanId,
          vendorName: data.vendorName,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        context.error('EMAF service error response:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText,
          url: `${this.emafServiceUrl}/internal/submissions/create`,
        });
        throw new Error(`EMAF service error: ${response.status} - ${errorText}`);
      }

      const result: any = await response.json();
      context.log('EMAF service response:', JSON.stringify(result, null, 2));
      
      // Handle response structure: { success: true, token: "...", emafUrl: "...", data: {...} }
      const token = result.token || result.data?.submissionId || result.data?.token;
      const emafUrl = result.emafUrl || (token ? `${this.getFrontendUrl()}/emaf/${token}` : undefined);
      
      if (!token) {
        throw new Error('EMAF service did not return a token in response');
      }
      
      context.log('EMAF submission created successfully:', { token, emafUrl });

      return {
        success: true,
        token: token as string,
        emafUrl: emafUrl as string,
      };
    } catch (error: any) {
      context.error('Failed to create EMAF submission:', error);
      throw new Error(`Failed to create EMAF submission: ${error.message}`);
    }
  }

  private getFrontendUrl(): string {
    return process.env.FRONTEND_URL || 'http://localhost:3000';
  }
}

export const emafService = new EmafService();
