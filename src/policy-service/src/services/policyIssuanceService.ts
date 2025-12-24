/**
 * Policy Issuance Service
 * Handles the process of issuing policies from approved quotations
 */

import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { cosmosService } from './cosmosService';
import { Policy, PolicyRequest } from '../models/policy';

export interface IssuePolicyParams {
  quotationId: string;
  leadId: string;
  customerId: string;
  selectedPlanId: string;
}

class PolicyIssuanceService {
  /**
   * Fetch quotation details from quotation-service
   */
  private async fetchQuotation(quotationId: string, leadId: string): Promise<any> {
    const quotationServiceUrl = process.env.QUOTATION_SERVICE_URL || 'http://localhost:7081';
    
    try {
      const response = await axios.get(`${quotationServiceUrl}/api/quotations/${quotationId}`, {
        params: { leadId },
        timeout: 10000,
      });
      
      if (response.data && response.data.success) {
        return response.data.data;
      }
      
      throw new Error('Failed to fetch quotation details');
    } catch (error: any) {
      console.error('Error fetching quotation:', error.message);
      throw new Error(`Could not fetch quotation ${quotationId}: ${error.message}`);
    }
  }

  /**
   * Fetch plan details from quotation-service
   */
  private async fetchPlanDetails(quotationId: string, planId: string): Promise<any> {
    const quotationServiceUrl = process.env.QUOTATION_SERVICE_URL || 'http://localhost:7081';
    
    try {
      const response = await axios.get(`${quotationServiceUrl}/api/quotations/${quotationId}/plans`, {
        timeout: 10000,
      });
      
      if (response.data && response.data.success) {
        const plans = response.data.data;
        const selectedPlan = plans.find((p: any) => p.planId === planId || p.id === planId);
        
        if (selectedPlan) {
          return selectedPlan;
        }
        
        throw new Error(`Plan ${planId} not found in quotation ${quotationId}`);
      }
      
      throw new Error('Failed to fetch plan details');
    } catch (error: any) {
      console.error('Error fetching plan details:', error.message);
      throw new Error(`Could not fetch plan ${planId}: ${error.message}`);
    }
  }

  /**
   * Issue a new policy from an approved quotation
   */
  async issuePolicy(params: IssuePolicyParams): Promise<Policy> {
    const { quotationId, leadId, customerId, selectedPlanId } = params;

    // Fetch quotation details
    const quotation = await this.fetchQuotation(quotationId, leadId);
    
    // Fetch selected plan details
    const selectedPlan = await this.fetchPlanDetails(quotationId, selectedPlanId);

    // Generate policy number
    const policyNumber = this.generatePolicyNumber();
    const policyId = uuidv4();
    const now = new Date();

    // Calculate policy dates (1 year policy by default)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);

    // Create policy with actual data from quotation and plan
    const policy: Policy = {
      id: policyId,
      policyNumber,
      customerId,
      leadId,
      quotationId,
      policyRequestId: undefined, // Only set if created from a policy request
      planId: selectedPlanId,

      // Vendor Information from selected plan
      vendorId: selectedPlan.vendorId || 'unknown',
      vendorName: selectedPlan.vendorName || 'Unknown Vendor',
      vendorCode: selectedPlan.vendorCode || 'UNKNOWN',

      // LOB Context from quotation
      lineOfBusiness: quotation.lineOfBusiness,
      businessType: quotation.businessType,

      // Policy Details from selected plan
      planName: selectedPlan.planName || 'Unknown Plan',
      planType: selectedPlan.planType || 'standard',

      // Financial from selected plan
      annualPremium: selectedPlan.annualPremium || 0,
      monthlyPremium: selectedPlan.monthlyPremium || 0,
      currency: quotation.currency || 'AED',

      // Coverage from selected plan
      annualLimit: selectedPlan.annualLimit || 0,
      deductible: selectedPlan.deductible || 0,
      coInsurance: selectedPlan.coInsurance || 0,

      // Duration
      startDate,
      endDate,
      issueDate: now,

      // Status
      status: 'active',

      // Documents
      policyDocument: undefined,
      policyDocumentGeneratedAt: undefined,

      // Renewal
      isRenewable: true,
      renewalDate: endDate,

      // Full Data Snapshot
      fullPlanData: selectedPlan.fullPlanData || selectedPlan,
      quotationSnapshot: quotation,
      leadSnapshot: quotation.leadSnapshot,

      // Metadata
      createdAt: now,
      updatedAt: now,
    };

    // Save policy to database
    await cosmosService.createPolicy(policy);

    // TODO: Generate policy PDF document
    // TODO: Publish policy.issued event to Event Grid
    // TODO: Notify customer via email/SMS

    return policy;
  }

  /**
   * Generate a unique policy number
   * Format: POL-YYYY-NNNNNN
   */
  private generatePolicyNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `POL-${year}-${random}`;
  }

  /**
   * Validate if a quotation is eligible for policy issuance
   */
  async validateQuotation(quotationId: string): Promise<boolean> {
    // TODO: Implement validation logic
    // - Check if quotation exists
    // - Check if quotation is approved
    // - Check if payment is received (if required)
    // - Check if all required documents are uploaded
    return true;
  }

  /**
   * Get effective and expiry dates for a policy
   */
  getPolicyDates(startDate?: Date): { effectiveDate: Date; expiryDate: Date } {
    const effectiveDate = startDate || new Date();
    const expiryDate = new Date(effectiveDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    return { effectiveDate, expiryDate };
  }
}

export const policyIssuanceService = new PolicyIssuanceService();

