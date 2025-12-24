/**
 * Internal Stage Update Endpoint
 * ONLY called by Pipeline Service - protected by service key
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';

interface InternalStageUpdateRequest {
  stageId: string;
  stageName: string;
  remark?: string;
  changedBy?: string;
}

export async function updateStageInternal(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    // Validate service key - ONLY Pipeline Service can call this
    const serviceKey = request.headers.get('x-service-key');
    const expectedKey = process.env.INTERNAL_SERVICE_KEY;

    if (!serviceKey || serviceKey !== expectedKey) {
      context.warn('Unauthorized access attempt to internal stage update endpoint');
      return {
        status: 401,
        jsonBody: {
          error: 'Unauthorized',
          message: 'This endpoint is only accessible by internal services'
        }
      };
    }

    const id = request.params.id;
    const lineOfBusiness = request.query.get('lineOfBusiness');
    const body: InternalStageUpdateRequest = await request.json() as InternalStageUpdateRequest;

    if (!id || !lineOfBusiness || !body.stageId || !body.stageName) {
      return {
        status: 400,
        jsonBody: {
          error: 'Missing required parameters',
          required: ['id', 'lineOfBusiness', 'stageId', 'stageName']
        }
      };
    }

    // Get existing lead
    let existingLead = await cosmosService.getLeadById(id, lineOfBusiness);
    if (!existingLead) {
      return {
        status: 404,
        jsonBody: { error: 'Lead not found' }
      };
    }

    if (existingLead.deletedAt) {
      return {
        status: 410,
        jsonBody: { error: 'Cannot update stage of deleted lead' }
      };
    }

    // Store ETag for optimistic concurrency
    let currentEtag = (existingLead as any)._etag;

    // Check if lead is already at this stage (idempotency)
    if (existingLead.currentStage === body.stageName && existingLead.stageId === body.stageId) {
      context.log(`Lead ${id} is already at stage ${body.stageName} - skipping update (idempotent)`);
      return {
        status: 200,
        jsonBody: {
          success: true,
          message: 'Lead already at requested stage',
          skipped: true,
          data: {
            lead: existingLead,
            stageChange: {
              from: existingLead.currentStage,
              to: body.stageName,
              unchanged: true
            }
          }
        }
      };
    }

    // Check for recent duplicate timeline entries (within last 2 minutes, more precise check)
    const DEDUP_TIME_WINDOW_MS = 2 * 60 * 1000; // 2 minutes (reduced from 5 for better precision)
    const DEDUP_PRECISE_WINDOW_MS = 10 * 1000; // 10 seconds for exact duplicates
    const twoMinutesAgo = new Date(Date.now() - DEDUP_TIME_WINDOW_MS);

    try {
      const recentTimelineEntries = await cosmosService.getTimelineEntries(id, {
        limit: 5,
        orderBy: 'timestamp',
        order: 'desc',
        stage: body.stageName,
        stageId: body.stageId,
        since: twoMinutesAgo
      });

      if (recentTimelineEntries.length > 0) {
        const mostRecent = recentTimelineEntries[0];
        const timeDiff = Date.now() - new Date(mostRecent.timestamp).getTime();
        
        // Check for exact duplicates within 10 seconds with same changedBy and remark
        if (timeDiff < DEDUP_PRECISE_WINDOW_MS) {
          const sameChangedBy = mostRecent.changedBy === (body.changedBy || 'pipeline-service');
          const sameRemark = mostRecent.remark === (body.remark || 'Updated by Pipeline Service');
          
          if (sameChangedBy && sameRemark) {
            context.log(`Exact duplicate timeline entry detected: ${body.stageName} was updated ${Math.round(timeDiff / 1000)}s ago with same changedBy and remark - skipping`);
            return {
              status: 200,
              jsonBody: {
                success: true,
                message: 'Exact duplicate timeline entry detected and skipped',
                duplicate: true,
                data: {
                  lead: existingLead,
                  lastUpdate: mostRecent.timestamp
                }
              }
            };
          }
        }
        
        // Check for any duplicate within 2 minutes
        if (timeDiff < DEDUP_TIME_WINDOW_MS) {
          context.log(`Duplicate stage update detected: ${body.stageName} was updated ${Math.round(timeDiff / 1000)}s ago - skipping`);
          return {
            status: 200,
            jsonBody: {
              success: true,
              message: 'Recent duplicate update detected and skipped',
              duplicate: true,
              data: {
                lead: existingLead,
                lastUpdate: mostRecent.timestamp
              }
            }
          };
        }
      }
    } catch (timelineError) {
      // Log but don't fail - time window check is a safety net
      context.warn(`Failed to check recent timeline entries for deduplication: ${timelineError}`);
      // Continue with update
    }

    // Update lead stage (Pipeline Service already validated this is allowed)
    // CRITICAL: Use retry logic with ETag optimistic concurrency to handle race conditions
    let updatedLead: any;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        updatedLead = await cosmosService.updateLead(id, lineOfBusiness, {
          currentStage: body.stageName,
          stageId: body.stageId
        }, currentEtag);
        break; // Success
      } catch (error: any) {
        retryCount++;
        
        // Handle ETag conflict (409 or 412) - lead was modified by another process
        if (error.code === 409 || error.code === 412 || error.statusCode === 409 || error.statusCode === 412) {
          context.log(`ETag conflict on attempt ${retryCount} - refreshing lead and re-checking idempotency`);
          
          // Refresh lead to get latest state and ETag
          const refreshedLead = await cosmosService.getLeadById(id, lineOfBusiness);
          if (!refreshedLead) {
            context.error(`Lead ${id} not found after ETag conflict`);
            throw new Error('Lead not found after ETag conflict');
          }
          
          existingLead = refreshedLead;
          currentEtag = (refreshedLead as any)._etag;
          
          // Re-check idempotency - lead might have been updated to requested stage by another process
          if (refreshedLead.currentStage === body.stageName && refreshedLead.stageId === body.stageId) {
            context.log(`Lead ${id} is now at stage ${body.stageName} (updated by another process) - skipping update (idempotent)`);
            return {
              status: 200,
              jsonBody: {
                success: true,
                message: 'Lead already at requested stage (updated by another process)',
                skipped: true,
                data: {
                  lead: refreshedLead,
                  stageChange: {
                    from: refreshedLead.currentStage,
                    to: body.stageName,
                    unchanged: true
                  }
                }
              }
            };
          }
          
          // Continue retry with fresh ETag
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500 * retryCount)); // Exponential backoff
            continue;
          }
        }
        
        if (retryCount >= maxRetries) {
          context.error(`Failed to update lead stage after ${maxRetries} attempts:`, error);
          throw error;
        }
        context.warn(`Lead stage update attempt ${retryCount} failed, retrying...`, error.message);
        await new Promise(resolve => setTimeout(resolve, 500 * retryCount)); // Exponential backoff
      }
    }

    // Create timeline entry
    await cosmosService.createTimelineEntry({
      id: uuidv4(),
      leadId: existingLead.id,
      stage: body.stageName,
      previousStage: existingLead.currentStage,
      stageId: body.stageId,
      remark: body.remark || 'Updated by Pipeline Service',
      changedBy: body.changedBy || 'pipeline-service',
      changedByName: 'Pipeline Service',
      timestamp: new Date()
    });

    // Publish lead.stage_changed event for audit/notification
    await eventGridService.publishLeadStageChanged({
      leadId: existingLead.id,
      referenceId: existingLead.referenceId,
      customerId: existingLead.customerId,
      oldStage: existingLead.currentStage,
      oldStageId: existingLead.stageId,
      newStage: body.stageName,
      newStageId: body.stageId,
      remark: body.remark,
      changedBy: body.changedBy || 'pipeline-service',
      timestamp: new Date()
    });

    context.log(`Lead stage updated by Pipeline Service: ${existingLead.referenceId} - ${existingLead.currentStage} → ${body.stageName}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Lead stage updated successfully',
        data: {
          lead: updatedLead,
          stageChange: {
            from: existingLead.currentStage,
            to: body.stageName
          }
        }
      }
    };
  } catch (error: any) {
    context.error('Internal stage update error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to update lead stage',
        details: error.message
      }
    };
  }
}

app.http('updateStageInternal', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'leads/{id}/stage/internal',
  handler: updateStageInternal
});
