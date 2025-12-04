/**
 * PolicyIssuedHandler - Event Grid handler for policy events
 */

import { app, EventGridEvent, InvocationContext } from '@azure/functions';
import { findStaffById, updateStaffWorkload, updateStaff } from '../../lib/staffRepository';
import { incrementWorkload, decrementWorkload } from '../../lib/workloadService';

interface PolicyEventData {
  policyId: string;
  assignedTo?: string;
  previousAssignee?: string;
  premium?: number;
}

export async function PolicyIssuedHandler(
  event: EventGridEvent,
  context: InvocationContext
): Promise<void> {
  context.log('PolicyIssuedHandler processing event:', event.eventType);

  try {
    const data = event.data as unknown as PolicyEventData;

    if (!data.assignedTo) {
      context.log('No assignee in policy event, skipping');
      return;
    }

    const staff = await findStaffById(data.assignedTo);
    if (!staff) {
      context.warn(`Staff member "${data.assignedTo}" not found`);
      return;
    }

    // Handle based on event type
    switch (event.eventType) {
      case 'policy.issued':
        // Increment policies count
        const newWorkload = incrementWorkload(staff.workload, 'activePolicies');
        await updateStaffWorkload(staff.staffId, newWorkload);

        // Update performance metrics
        const currentPeriod = new Date().toISOString().slice(0, 7);
        const currentPerformance = staff.performance || {
          period: currentPeriod,
          leadsConverted: 0,
          policiesIssued: 0,
          premiumGenerated: 0,
        };

        // Only update if same period
        if (currentPerformance.period === currentPeriod) {
          await updateStaff(staff.staffId, {
            metadata: {
              ...staff.metadata,
              performance: {
                ...currentPerformance,
                policiesIssued: currentPerformance.policiesIssued + 1,
                premiumGenerated: currentPerformance.premiumGenerated + (data.premium || 0),
              },
            },
          }, 'system');
        }

        context.log(`Policy issued for ${staff.staffId}`);
        break;

      case 'policy.assigned':
        // Update policy assignment
        const assignedWorkload = incrementWorkload(staff.workload, 'activePolicies');
        await updateStaffWorkload(staff.staffId, assignedWorkload);

        // If reassignment, decrement for previous assignee
        if (data.previousAssignee && data.previousAssignee !== data.assignedTo) {
          const prevStaff = await findStaffById(data.previousAssignee);
          if (prevStaff) {
            const prevWorkload = decrementWorkload(prevStaff.workload, 'activePolicies');
            await updateStaffWorkload(prevStaff.staffId, prevWorkload);
          }
        }
        break;

      default:
        context.log(`Unhandled policy event type: ${event.eventType}`);
    }
  } catch (error) {
    context.error('PolicyIssuedHandler error:', error);
  }
}

app.eventGrid('PolicyIssuedHandler', {
  handler: PolicyIssuedHandler,
});

