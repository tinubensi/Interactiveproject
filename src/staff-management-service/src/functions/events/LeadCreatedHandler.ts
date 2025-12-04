/**
 * LeadCreatedHandler - Event Grid handler for lead events
 */

import { app, EventGridEvent, InvocationContext } from '@azure/functions';
import { findStaffById, updateStaffWorkload } from '../../lib/staffRepository';
import { incrementWorkload, decrementWorkload } from '../../lib/workloadService';

interface LeadEventData {
  leadId: string;
  assignedTo?: string;
  previousAssignee?: string;
  convertedToCustomerId?: string;
}

export async function LeadCreatedHandler(
  event: EventGridEvent,
  context: InvocationContext
): Promise<void> {
  context.log('LeadCreatedHandler processing event:', event.eventType);

  try {
    const data = event.data as unknown as LeadEventData;

    if (!data.assignedTo) {
      context.log('No assignee in lead event, skipping');
      return;
    }

    const staff = await findStaffById(data.assignedTo);
    if (!staff) {
      context.warn(`Staff member "${data.assignedTo}" not found`);
      return;
    }

    // Handle based on event type
    switch (event.eventType) {
      case 'lead.created':
      case 'lead.assigned':
        // Increment lead count for new assignee
        const newWorkload = incrementWorkload(staff.workload, 'activeLeads');
        await updateStaffWorkload(staff.staffId, newWorkload);
        context.log(`Incremented activeLeads for ${staff.staffId}`);

        // If reassignment, decrement for previous assignee
        if (data.previousAssignee && data.previousAssignee !== data.assignedTo) {
          const prevStaff = await findStaffById(data.previousAssignee);
          if (prevStaff) {
            const prevWorkload = decrementWorkload(prevStaff.workload, 'activeLeads');
            await updateStaffWorkload(prevStaff.staffId, prevWorkload);
            context.log(`Decremented activeLeads for ${prevStaff.staffId}`);
          }
        }
        break;

      case 'lead.converted':
        // Decrement leads, increment customers
        let workload = decrementWorkload(staff.workload, 'activeLeads');
        workload = incrementWorkload(workload, 'activeCustomers');
        await updateStaffWorkload(staff.staffId, workload);
        context.log(`Lead converted for ${staff.staffId}`);
        break;

      case 'lead.closed':
        // Just decrement leads
        const closedWorkload = decrementWorkload(staff.workload, 'activeLeads');
        await updateStaffWorkload(staff.staffId, closedWorkload);
        context.log(`Decremented activeLeads for ${staff.staffId}`);
        break;

      default:
        context.log(`Unhandled lead event type: ${event.eventType}`);
    }
  } catch (error) {
    context.error('LeadCreatedHandler error:', error);
  }
}

app.eventGrid('LeadCreatedHandler', {
  handler: LeadCreatedHandler,
});

