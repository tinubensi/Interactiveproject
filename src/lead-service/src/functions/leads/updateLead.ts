/**
 * Update Lead Function
 * Updates an existing lead
 * Reference: Petli updateLead controller
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { validateUpdateLeadRequest, sanitizeInput } from '../../utils/validation';
import { UpdateLeadRequest } from '../../models/lead';

export async function updateLead(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const id = request.params.id;
    const lineOfBusiness = request.query.get('lineOfBusiness');
    const body: UpdateLeadRequest = await request.json() as UpdateLeadRequest;

    if (!id) {
      return {
        status: 400,
        jsonBody: {
          error: 'Lead ID is required'
        }
      };
    }

    if (!lineOfBusiness) {
      return {
        status: 400,
        jsonBody: {
          error: 'lineOfBusiness query parameter is required'
        }
      };
    }

    // Validate request
    const validation = validateUpdateLeadRequest(body);
    if (!validation.valid) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation failed',
          details: validation.errors
        }
      };
    }

    // Get existing lead
    const existingLead = await cosmosService.getLeadById(id, lineOfBusiness);
    if (!existingLead) {
      return {
        status: 404,
        jsonBody: {
          error: 'Lead not found'
        }
      };
    }

    if (existingLead.deletedAt) {
      return {
        status: 410,
        jsonBody: {
          error: 'Cannot update deleted lead'
        }
      };
    }

    // Track changes for event
    const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

    // Prepare updates
    const updates: Partial<typeof existingLead> = {};

    if (body.firstName && body.firstName !== existingLead.firstName) {
      const newFirstName = sanitizeInput(body.firstName);
      updates.firstName = newFirstName;
      changes.push({ field: 'firstName', oldValue: existingLead.firstName, newValue: newFirstName });
    }

    if (body.lastName && body.lastName !== existingLead.lastName) {
      const newLastName = sanitizeInput(body.lastName);
      updates.lastName = newLastName;
      changes.push({ field: 'lastName', oldValue: existingLead.lastName, newValue: newLastName });
    }

    if (updates.firstName || updates.lastName) {
      updates.fullName = `${updates.firstName || existingLead.firstName} ${updates.lastName || existingLead.lastName}`;
    }

    if (body.email && body.email !== existingLead.email) {
      updates.email = body.email;
      changes.push({ field: 'email', oldValue: existingLead.email, newValue: body.email });
    }

    if (body.phone && body.phone.number !== existingLead.phone.number) {
      updates.phone = body.phone;
      changes.push({ field: 'phone', oldValue: existingLead.phone, newValue: body.phone });
    }

    if (body.emirate && body.emirate !== existingLead.emirate) {
      updates.emirate = body.emirate;
      changes.push({ field: 'emirate', oldValue: existingLead.emirate, newValue: body.emirate });
    }

    if (body.assignedTo && body.assignedTo !== existingLead.assignedTo) {
      updates.assignedTo = body.assignedTo;
      changes.push({ field: 'assignedTo', oldValue: existingLead.assignedTo, newValue: body.assignedTo });

      // Publish assignment event (optional - don't fail if Event Grid is down)
      try {
        await eventGridService.publishLeadAssigned({
          leadId: existingLead.id,
          referenceId: existingLead.referenceId,
          customerId: existingLead.customerId,
          previousAssignee: existingLead.assignedTo,
          newAssignee: body.assignedTo,
          assignedBy: body.assignedTo, // TODO: Get from auth context
          timestamp: new Date()
        });
      } catch (eventError) {
        context.warn('Failed to publish lead.assigned event (Event Grid unavailable)');
      }

      // Add timeline entry
      await cosmosService.createTimelineEntry({
        id: uuidv4(),
        leadId: existingLead.id,
        stage: existingLead.currentStage,
        stageId: existingLead.stageId,
        remark: `Assigned to ${body.assignedTo}`,
        changedBy: body.assignedTo,
        changedByName: 'User', // TODO: Get from auth context
        timestamp: new Date()
      });
    }

    if (body.lobData) {
      updates.lobData = {
        ...existingLead.lobData,
        ...body.lobData
      };
      changes.push({ field: 'lobData', oldValue: existingLead.lobData, newValue: updates.lobData });
    }

    if (body.formData) {
      updates.formData = body.formData;
      updates.lobData = {
        ...existingLead.lobData,
        ...body.formData
      };
      changes.push({ field: 'formData', oldValue: existingLead.formData, newValue: body.formData });
    }

    if (body.source && body.source !== existingLead.source) {
      updates.source = body.source;
      changes.push({ field: 'source', oldValue: existingLead.source, newValue: body.source });
    }

    if (body.isHotLead !== undefined && body.isHotLead !== existingLead.isHotLead) {
      updates.isHotLead = body.isHotLead;
      changes.push({ field: 'isHotLead', oldValue: existingLead.isHotLead, newValue: body.isHotLead });

      if (body.isHotLead) {
        // Publish hot lead marked event (optional - don't fail if Event Grid is down)
        try {
          await eventGridService.publishLeadHotLeadMarked({
            leadId: existingLead.id,
            referenceId: existingLead.referenceId,
            customerId: existingLead.customerId,
            markedBy: body.assignedTo, // TODO: Get from auth context
            timestamp: new Date()
          });
        } catch (eventError) {
          context.warn('Failed to publish lead.hot_lead_marked event (Event Grid unavailable)');
        }
      }
    }

    // Update lead
    const updatedLead = await cosmosService.updateLead(id, lineOfBusiness, updates);

    // Publish lead.updated event if there were changes (optional - don't fail if Event Grid is down)
    if (changes.length > 0) {
      try {
        await eventGridService.publishLeadUpdated({
          leadId: updatedLead.id,
          referenceId: updatedLead.referenceId,
          customerId: updatedLead.customerId,
          changes,
          updatedBy: body.assignedTo, // TODO: Get from auth context
          updatedAt: updatedLead.updatedAt
        });
        context.log('Lead updated event published successfully');
      } catch (eventError) {
        context.warn('Failed to publish lead.updated event (Event Grid unavailable):', eventError);
        // Don't fail the update if event publishing fails
      }
    }

    context.log(`Lead updated successfully: ${updatedLead.referenceId}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Lead updated successfully',
        data: {
          lead: updatedLead,
          changes
        }
      }
    };
  } catch (error: any) {
    context.error('Update lead error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to update lead',
        details: error.message
      }
    };
  }
}

app.http('updateLead', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'leads/{id}',
  handler: updateLead
});


