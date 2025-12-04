/**
 * CustomerCreatedHandler - Event Grid handler for customer events
 */

import { app, EventGridEvent, InvocationContext } from '@azure/functions';
import { findStaffById, updateStaffWorkload } from '../../lib/staffRepository';
import { incrementWorkload, decrementWorkload } from '../../lib/workloadService';

interface CustomerEventData {
  customerId: string;
  assignedTo?: string;
  previousAssignee?: string;
}

export async function CustomerCreatedHandler(
  event: EventGridEvent,
  context: InvocationContext
): Promise<void> {
  context.log('CustomerCreatedHandler processing event:', event.eventType);

  try {
    const data = event.data as unknown as CustomerEventData;

    if (!data.assignedTo) {
      context.log('No assignee in customer event, skipping');
      return;
    }

    const staff = await findStaffById(data.assignedTo);
    if (!staff) {
      context.warn(`Staff member "${data.assignedTo}" not found`);
      return;
    }

    // Handle based on event type
    switch (event.eventType) {
      case 'customer.created':
      case 'customer.assigned':
        // Increment customer count for new assignee
        const newWorkload = incrementWorkload(staff.workload, 'activeCustomers');
        await updateStaffWorkload(staff.staffId, newWorkload);
        context.log(`Incremented activeCustomers for ${staff.staffId}`);

        // If reassignment, decrement for previous assignee
        if (data.previousAssignee && data.previousAssignee !== data.assignedTo) {
          const prevStaff = await findStaffById(data.previousAssignee);
          if (prevStaff) {
            const prevWorkload = decrementWorkload(prevStaff.workload, 'activeCustomers');
            await updateStaffWorkload(prevStaff.staffId, prevWorkload);
            context.log(`Decremented activeCustomers for ${prevStaff.staffId}`);
          }
        }
        break;

      default:
        context.log(`Unhandled customer event type: ${event.eventType}`);
    }
  } catch (error) {
    context.error('CustomerCreatedHandler error:', error);
  }
}

app.eventGrid('CustomerCreatedHandler', {
  handler: CustomerCreatedHandler,
});

