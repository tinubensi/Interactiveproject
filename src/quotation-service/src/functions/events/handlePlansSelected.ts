/**
 * Handle Plans Selected Event
 * Auto-creates quotation when plans are selected
 * Listens to plans.selected event from Quotation Generation Service
 */

import { app, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { generateQuotationReferenceId } from '../../utils/referenceGenerator';
import { PlansSelectedEvent } from '../../models/events';
import { Quotation, QuotationPlan } from '../../models/quotation';

export async function handlePlansSelected(
  eventGridEvent: any,
  context: InvocationContext
): Promise<void> {
  try {
    const event = eventGridEvent as PlansSelectedEvent;
    const data = event.data;

    context.log(`Received plans.selected event for lead ${data.leadId}`);

    // Fetch plans (mock for now)
    const selectedPlans = data.planIds.map((id: string, index: number) => ({
      id,
      leadId: data.leadId,
      vendorId: `vendor-${index + 1}`,
      vendorName: `Vendor ${index + 1}`,
      vendorCode: `V${index + 1}`,
      planName: `Plan ${index + 1}`,
      planCode: `P${index + 1}`,
      planType: 'premium',
      annualPremium: 2000 + (index * 500),
      monthlyPremium: 180 + (index * 45),
      currency: 'AED',
      annualLimit: 100000,
      deductible: 250,
      coInsurance: 10,
      waitingPeriod: 7
    }));

    const totalPremium = selectedPlans.reduce((sum: number, plan: any) => sum + plan.annualPremium, 0);

    // Check for existing quotation
    const existingQuotation = await cosmosService.getCurrentQuotation(data.leadId);
    let version = 1;
    if (existingQuotation) {
      await cosmosService.markQuotationAsSuperseded(existingQuotation.id, existingQuotation.leadId);
      version = existingQuotation.version + 1;
    }

    // Create quotation
    const quotationId = uuidv4();
    const referenceId = await generateQuotationReferenceId();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    const quotation: Quotation = {
      id: quotationId,
      referenceId,
      leadId: data.leadId,
      customerId: 'customer-' + data.leadId, // TODO: Get from lead
      planIds: data.planIds,
      lineOfBusiness: 'medical', // TODO: Get from lead
      businessType: 'individual', // TODO: Get from lead
      totalPremium,
      currency: 'AED',
      validUntil,
      termsAndConditions: 'Standard terms and conditions apply.',
      status: 'draft',
      isCurrentVersion: true,
      version,
      previousVersionId: existingQuotation?.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await cosmosService.createQuotation(quotation);

    // Create quotation plan snapshots
    const quotationPlans: QuotationPlan[] = selectedPlans.map((plan: any) => ({
      id: uuidv4(),
      quotationId,
      planId: plan.id,
      leadId: data.leadId,
      vendorId: plan.vendorId,
      vendorName: plan.vendorName,
      vendorCode: plan.vendorCode,
      planName: plan.planName,
      planCode: plan.planCode,
      planType: plan.planType,
      annualPremium: plan.annualPremium,
      monthlyPremium: plan.monthlyPremium,
      currency: plan.currency,
      annualLimit: plan.annualLimit,
      deductible: plan.deductible,
      coInsurance: plan.coInsurance,
      waitingPeriod: plan.waitingPeriod,
      fullPlanData: plan,
      isSelected: false,
      createdAt: new Date()
    }));

    await cosmosService.createQuotationPlans(quotationPlans);

    // Publish event
    await eventGridService.publishQuotationCreated({
      quotationId,
      referenceId,
      leadId: data.leadId,
      customerId: quotation.customerId,
      lineOfBusiness: quotation.lineOfBusiness,
      totalPremium,
      planCount: quotationPlans.length,
      version
    });

    context.log(`Auto-created quotation ${referenceId} for lead ${data.leadId}`);
  } catch (error: any) {
    context.error('Handle plans selected error:', error);
  }
}

app.eventGrid('handlePlansSelected', {
  handler: handlePlansSelected
});


