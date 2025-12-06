/**
 * Create Comparison Function
 * Creates a side-by-side comparison of selected plans
 * Reference: Petli generateComparison
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { PlanComparison, ComparisonRow } from '../../models/plan';
import { ensureAuthorized, requirePermission, QUOTE_PERMISSIONS } from '../../lib/auth';

export async function createComparison(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, QUOTE_PERMISSIONS.QUOTES_READ);
    const body: any = await request.json();
    const { leadId, planIds } = body;

    if (!leadId || !planIds || planIds.length < 2) {
      return {
        status: 400,
        jsonBody: {
          error: 'leadId and at least 2 planIds are required'
        }
      };
    }

    if (planIds.length > 5) {
      return {
        status: 400,
        jsonBody: {
          error: 'Maximum 5 plans can be compared'
        }
      };
    }

    // Fetch all plans
    const plans = await Promise.all(
      planIds.map((id: string) => cosmosService.getPlanById(id, leadId))
    );

    // Verify all plans exist
    if (plans.some(p => !p)) {
      return {
        status: 404,
        jsonBody: {
          error: 'One or more plans not found'
        }
      };
    }

    // Build comparison matrix
    const comparisonMatrix: ComparisonRow[] = [];

    // Pricing comparisons
    comparisonMatrix.push({
      feature: 'Annual Premium',
      category: 'Pricing',
      plans: Object.fromEntries(plans.map(p => [p!.id, `${p!.annualPremium} ${p!.currency}`]))
    });

    comparisonMatrix.push({
      feature: 'Monthly Premium',
      category: 'Pricing',
      plans: Object.fromEntries(plans.map(p => [p!.id, `${p!.monthlyPremium} ${p!.currency}`]))
    });

    // Coverage comparisons
    comparisonMatrix.push({
      feature: 'Annual Limit',
      category: 'Coverage',
      plans: Object.fromEntries(plans.map(p => [p!.id, `${p!.annualLimit} ${p!.currency}`]))
    });

    comparisonMatrix.push({
      feature: 'Deductible',
      category: 'Coverage',
      plans: Object.fromEntries(plans.map(p => [p!.id, `${p!.deductible} ${p!.currency}`]))
    });

    comparisonMatrix.push({
      feature: 'Co-Insurance',
      category: 'Coverage',
      plans: Object.fromEntries(plans.map(p => [p!.id, `${p!.coInsurance}%`]))
    });

    comparisonMatrix.push({
      feature: 'Waiting Period',
      category: 'Coverage',
      plans: Object.fromEntries(plans.map(p => [p!.id, `${p!.waitingPeriod} days`]))
    });

    // Benefit comparisons
    const allBenefitCategories = new Set<string>();
    plans.forEach(p => p!.benefits.forEach((b: any) => allBenefitCategories.add(b.categoryName)));

    allBenefitCategories.forEach(categoryName => {
      const categoryBenefits = new Set<string>();
      plans.forEach(p => {
        const category = p!.benefits.find((b: any) => b.categoryName === categoryName);
        if (category) {
          category.benefits.forEach((b: any) => categoryBenefits.add(b.name));
        }
      });

      categoryBenefits.forEach(benefitName => {
        const benefitComparison: any = {};
        plans.forEach(p => {
          const category = p!.benefits.find((b: any) => b.categoryName === categoryName);
          const benefit = category?.benefits.find((b: any) => b.name === benefitName);
          
          if (benefit) {
            if (benefit.covered) {
              benefitComparison[p!.id] = benefit.limit 
                ? `✓ (${benefit.limit} ${benefit.limitMetric || ''})` 
                : '✓';
            } else {
              benefitComparison[p!.id] = '✗';
            }
          } else {
            benefitComparison[p!.id] = '—';
          }
        });

        comparisonMatrix.push({
          feature: benefitName,
          category: categoryName,
          plans: benefitComparison
        });
      });
    });

    // Create comparison record
    const comparison: PlanComparison = {
      id: uuidv4(),
      leadId,
      planIds,
      comparisonMatrix,
      createdAt: new Date()
    };

    await cosmosService.createComparison(comparison);

    // Publish event
    await eventGridService.publishPlansCompared({
      leadId,
      comparisonId: comparison.id,
      planIds
    });

    context.log(`Comparison created for lead ${leadId} with ${planIds.length} plans`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Comparison created successfully',
        data: {
          comparison,
          plans: plans.filter(p => p !== null)
        }
      }
    };
  } catch (error: any) {
    context.error('Create comparison error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to create comparison',
        details: error.message
      }
    };
  }
}

app.http('createComparison', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'plans/compare',
  handler: createComparison
});

