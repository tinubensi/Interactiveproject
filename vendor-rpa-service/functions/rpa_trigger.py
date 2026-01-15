"""
RPA Trigger Function - Core orchestration logic
Enqueues RPA job messages to Azure Storage Queue for KEDA-triggered Container Jobs
"""
import azure.functions as func
import json
import logging
import asyncio
from typing import Dict, List

from shared.vendor_loader import get_vendors_for_lob
from shared.job_starter import start_container_job

logger = logging.getLogger(__name__)


async def handle_lead_created_http(lead_data: Dict) -> Dict:
    """
    Main handler for HTTP lead creation requests (QUEUE-BASED)
    
    This function:
    1. Receives lead data from HTTP request
    2. Identifies vendors based on Line of Business
    3. **Enqueues messages to Azure Storage Queue**
    4. KEDA monitors queue and triggers Container Jobs automatically
    5. Returns immediately with results
    
    Args:
        lead_data: Dictionary containing lead information
        
    Returns:
        Dict with success status and enqueued vendors
    """
    try:
        logger.info('🚀 Processing HTTP lead creation request (QUEUE MODE)')
        
        # Extract lead information
        lead_id = lead_data.get('id') or lead_data.get('leadId')
        lob = lead_data.get('lineOfBusiness')
        
        if not lead_id or not lob:
            logger.error('Missing required lead data: id/leadId or lineOfBusiness')
            return {
                "success": False,
                "error": "Missing required fields: id/leadId and lineOfBusiness"
            }
        
        logger.info(f'Processing lead {lead_id} for LOB: {lob}')
        
        # Get vendors for this Line of Business
        vendors = get_vendors_for_lob(lob)
        
        if not vendors:
            logger.warning(f'No enabled vendors found for LOB: {lob}')
            return {
                "success": True,
                "leadId": lead_id,
                "vendorsTriggered": [],
                "message": f"No vendors enabled for {lob}"
            }
        
        logger.info(f'Found {len(vendors)} enabled vendors: {[v["id"] for v in vendors]}')
        
        # Enqueue messages for each vendor (QUEUE-BASED)
        triggered_vendors = []
        failed_vendors = []
        
        for vendor in vendors:
            vendor_id = vendor['id']
            vendor_name = vendor.get('name', vendor_id)
            
            logger.info(f'📥 Enqueuing RPA job for vendor: {vendor_id}')
            
            try:
                # Add vendor name to lead data
                lead_data_with_vendor = {
                    **lead_data,
                    'vendorName': vendor_name
                }
                
                # Enqueue message to Azure Storage Queue
                result = await start_container_job(
                    vendor_id=vendor_id,
                    lead_data=lead_data_with_vendor
                )
                
                if result.get('success'):
                    triggered_vendors.append(vendor_id)
                    logger.info(f'✅ Successfully enqueued job for {vendor_id}: {result.get("message_id")}')
                else:
                    failed_vendors.append({
                        "vendorId": vendor_id,
                        "error": result.get('error', 'Unknown error')
                    })
                    logger.error(f'❌ Failed to enqueue job for {vendor_id}: {result.get("error")}')
                    
            except Exception as e:
                failed_vendors.append({
                    "vendorId": vendor_id,
                    "error": str(e)
                })
                logger.error(f'❌ Exception enqueuing job for {vendor_id}: {str(e)}', exc_info=True)
        
        # Return summary
        logger.info(f'✅ Message enqueuing complete: {len(triggered_vendors)} successful, {len(failed_vendors)} failed')
        
        return {
            "success": True,
            "leadId": lead_id,
            "lineOfBusiness": lob,
            "vendorsTriggered": triggered_vendors,
            "vendorsFailed": failed_vendors,
            "message": f"Enqueued RPA jobs for {len(triggered_vendors)} vendor(s). KEDA will trigger container jobs."
        }
        
    except Exception as e:
        logger.error(f'Error processing lead: {str(e)}', exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to process lead"
        }


async def handle_lead_created(event: func.EventGridEvent) -> Dict:
    """
    Main handler for lead.created events
    
    This function:
    1. Parses lead data from Event Grid event
    2. Identifies vendors based on Line of Business
    3. Triggers Container Apps Jobs for each vendor
    4. Returns immediately without waiting for RPA completion
    
    Args:
        event: Event Grid event containing lead data
        
    Returns:
        Dict with status and triggered vendors
    """
    try:
        logger.info('Processing Event Grid event')
        
        # Parse event data
        event_data = json.loads(event.get_json()) if isinstance(event.get_json(), str) else event.get_json()
        
        # Handle different event structures
        if isinstance(event_data, list):
            # Array of events
            event_data = event_data[0] if event_data else {}
        
        lead_data = event_data.get('data', {})
        event_type = event_data.get('eventType', '')
        
        logger.info(f'Event type: {event_type}')
        logger.info(f'Lead ID: {lead_data.get("id")}')
        
        # Validate this is a lead creation event
        if not event_type or ('create' not in event_type.lower() and 'lead' not in event_type.lower()):
            logger.warning(f'Ignoring non-lead-creation event: {event_type}')
            return {
                "status": "skipped",
                "reason": f"Not a lead creation event: {event_type}"
            }
        
        # Extract lead information
        lead_id = lead_data.get('id')
        lob = lead_data.get('lineOfBusiness')
        
        if not lead_id or not lob:
            logger.error('Missing required lead data: id or lineOfBusiness')
            return {
                "status": "error",
                "error": "Missing required lead data"
            }
        
        logger.info(f'Processing lead {lead_id} for LOB: {lob}')
        
        # Get vendors for this Line of Business
        vendors = get_vendors_for_lob(lob)
        
        if not vendors:
            logger.warning(f'No enabled vendors found for LOB: {lob}')
            return {
                "status": "skipped",
                "reason": f"No vendors enabled for {lob}",
                "lead_id": lead_id
            }
        
        logger.info(f'Found {len(vendors)} enabled vendors: {[v["id"] for v in vendors]}')
        
        # Trigger Container Jobs for each vendor (non-blocking)
        results = []
        for vendor in vendors:
            vendor_id = vendor['id']
            vendor_name = vendor.get('name', vendor_id)
            
            logger.info(f'Publishing Event Grid event for vendor: {vendor_id}')
            
            try:
                # Add vendor name to lead data
                lead_data_with_vendor = {
                    **lead_data,
                    'vendorName': vendor_name
                }
                
                success = publish_rpa_event(
                    vendor_id=vendor_id,
                    lead_data=lead_data_with_vendor
                )
                
                result = {
                    "vendor_id": vendor_id,
                    "success": success
                }
                results.append(result)
                
                if success:
                    logger.info(f'Successfully published event for {vendor_id}')
                else:
                    logger.error(f'Failed to publish event for {vendor_id}')
                    
            except Exception as e:
                logger.error(f'Exception publishing event for {vendor_id}: {str(e)}', exc_info=True)
                results.append({
                    "success": False,
                    "vendor_id": vendor_id,
                    "error": str(e)
                })
        
        # Return summary (function completes in ~3 seconds)
        successful = [r for r in results if r.get('success')]
        failed = [r for r in results if not r.get('success')]
        
        logger.info(f'RPA trigger complete: {len(successful)} successful, {len(failed)} failed')
        
        return {
            "status": "triggered",
            "lead_id": lead_id,
            "lob": lob,
            "total_vendors": len(vendors),
            "successful": len(successful),
            "failed": len(failed),
            "results": results
        }
        
    except Exception as e:
        logger.error(f'Error processing Event Grid event: {str(e)}', exc_info=True)
        return {
            "status": "error",
            "error": str(e)
        }
