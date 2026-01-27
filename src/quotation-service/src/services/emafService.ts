/**
 * EMAF Service Client for Quotation Service
 * Handles communication with the EMAF service
 */

import axios from 'axios';
import { InvocationContext } from '@azure/functions';

interface CreateEmafSubmissionParams {
  leadId: string;
  quotationId: string;
  customerName: string;
  customerEmail: string;
  selectedPlanId: string;
  vendorId: string;
  vendorName: string;
}

interface CreateEmafSubmissionResult {
  token: string;
  emafUrl: string;
}

class EmafService {
  private getEmafServiceUrl(): string {
    const baseUrl = process.env.EMAF_SERVICE_URL || 'http://localhost:7078';
    return baseUrl.includes('/api') ? baseUrl : `${baseUrl}/api`;
  }

  async createEmafSubmission(
    params: CreateEmafSubmissionParams,
    context?: InvocationContext
  ): Promise<CreateEmafSubmissionResult> {
    const emafServiceUrl = this.getEmafServiceUrl();
    const endpoint = `${emafServiceUrl}/emaf/submissions`;

    try {
      const response = await axios.post(
        endpoint,
        {
          leadId: params.leadId,
          quotationId: params.quotationId,
          customerName: params.customerName,
          customerEmail: params.customerEmail,
          selectedPlanId: params.selectedPlanId,
          vendorId: params.vendorId,
          vendorName: params.vendorName,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-service-key': process.env.INTERNAL_SERVICE_KEY || '',
          },
          timeout: 30000, // 30 seconds
        }
      );

      if (response.data && response.data.success && response.data.data) {
        const data = response.data.data;
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const emafUrl = `${frontendUrl}/emaf/${data.token || data.id}`;

        return {
          token: data.token || data.id,
          emafUrl,
        };
      }

      throw new Error('Invalid response from EMAF service');
    } catch (error: any) {
      if (context) {
        context.error('Failed to create EMAF submission:', error.message);
      }
      throw new Error(`EMAF service error: ${error.message || 'Unknown error'}`);
    }
  }
}

export const emafService = new EmafService();
