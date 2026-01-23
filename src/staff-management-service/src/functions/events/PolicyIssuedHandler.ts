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
    const defaultWorkload = { activeLeads: 0, activeCustomers: 0, activePolicies: 0, pendingApprovals: 0 };
    switch (event.eventType) {
      case 'policy.issued':
        // Increment policies count
        const newWorkload = incrementWorkload(staff.workload || defaultWorkload, 'activePolicies');
        await updateStaffWorkload(staff.staffId, newWorkload);

        // Note: Performance metrics removed from simplified model
        context.log(`Policy issued for ${staff.staffId}`);
        break;

      case 'policy.assigned':
        // Update policy assignment
        const assignedWorkload = incrementWorkload(staff.workload || defaultWorkload, 'activePolicies');
        await updateStaffWorkload(staff.staffId, assignedWorkload);

        // If reassignment, decrement for previous assignee
        if (data.previousAssignee && data.previousAssignee !== data.assignedTo) {
          const prevStaff = await findStaffById(data.previousAssignee);
          if (prevStaff) {
            const prevWorkload = decrementWorkload(prevStaff.workload || defaultWorkload, 'activePolicies');
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

