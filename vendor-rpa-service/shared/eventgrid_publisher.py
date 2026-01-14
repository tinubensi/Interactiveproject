"""
Event Grid Publisher - Publishes RPA events to Azure Event Grid
"""
import os
import logging
from typing import Dict
from azure.eventgrid import EventGridPublisherClient, EventGridEvent
from azure.core.credentials import AzureKeyCredential
from datetime import datetime

logger = logging.getLogger(__name__)


def publish_rpa_event(vendor_id: str, lead_data: Dict) -> bool:
    """
    Publish RPA event to Event Grid for a specific vendor
    
    Args:
        vendor_id: Vendor identifier (e.g., "watania", "nextcare")
        lead_data: Full lead data dictionary
        
    Returns:
        bool: True if event published successfully, False otherwise
    """
    try:
        endpoint = os.environ.get('EVENTGRID_TOPIC_ENDPOINT')
        key = os.environ.get('EVENTGRID_TOPIC_KEY')
        
        if not endpoint or not key:
            logger.error('EVENTGRID_TOPIC_ENDPOINT or EVENTGRID_TOPIC_KEY not set')
            return False
        
        logger.info(f'Publishing RPA event for vendor: {vendor_id}')
        
        # Create Event Grid client
        credential = AzureKeyCredential(key)
        client = EventGridPublisherClient(endpoint, credential)
        
        # Create event
        event = EventGridEvent(
            event_type="vendor.rpa.requested",
            subject=f"/vendors/{vendor_id}",
            data={
                "vendorId": vendor_id,
                "vendorName": lead_data.get('vendorName', vendor_id),
                "leadData": lead_data,
                "timestamp": datetime.utcnow().isoformat()
            },
            data_version="1.0"
        )
        
        # Send event
        client.send(event)
        
        logger.info(f'✅ Successfully published event for vendor: {vendor_id}')
        return True
        
    except Exception as e:
        logger.error(f'❌ Failed to publish event for vendor {vendor_id}: {str(e)}', exc_info=True)
        return False


def publish_plans_fetch_failed_event(
    lead_id: str, 
    vendor_id: str, 
    error: str, 
    error_type: str
) -> bool:
    """
    Publish plans.fetch_failed event to Event Grid
    
    Args:
        lead_id: Lead identifier
        vendor_id: Vendor identifier
        error: Error message
        error_type: Type of error (exception class name)
        
    Returns:
        bool: True if event published successfully
    """
    try:
        endpoint = os.environ.get('EVENTGRID_TOPIC_ENDPOINT')
        key = os.environ.get('EVENTGRID_TOPIC_KEY')
        
        logger.info(f"[EVENT_GRID] Publishing plans.fetch_failed", extra={
            'custom_dimensions': {
                'lead_id': lead_id,
                'vendor_id': vendor_id,
                'error_type': error_type,
                'endpoint': endpoint[:50] if endpoint else 'NOT_SET'
            }
        })
        
        if not endpoint or not key:
            logger.error('[EVENT_GRID] Missing credentials', extra={
                'custom_dimensions': {
                    'lead_id': lead_id,
                    'vendor_id': vendor_id,
                    'has_endpoint': bool(endpoint),
                    'has_key': bool(key)
                }
            })
            logger.error('EVENTGRID_TOPIC_ENDPOINT or EVENTGRID_TOPIC_KEY not set')
            return False
        
        logger.info(f'Publishing plans.fetch_failed event for lead: {lead_id}')
        
        credential = AzureKeyCredential(key)
        client = EventGridPublisherClient(endpoint, credential)
        
        event = EventGridEvent(
            event_type="plans.fetch_failed",
            subject=f"/leads/{lead_id}/vendors/{vendor_id}",
            data={
                "leadId": lead_id,
                "vendorId": vendor_id,
                "error": error,
                "errorType": error_type,
                "timestamp": datetime.utcnow().isoformat()
            },
            data_version="1.0"
        )
        
        client.send(event)
        
        logger.info(f"[EVENT_GRID] Event published successfully", extra={
            'custom_dimensions': {
                'lead_id': lead_id,
                'vendor_id': vendor_id,
                'error_type': error_type,
                'status': 'success'
            }
        })
        logger.info(f'✅ Successfully published plans.fetch_failed event')
        return True
        
    except Exception as e:
        logger.error(f"[EVENT_GRID] Publishing failed", extra={
            'custom_dimensions': {
                'lead_id': lead_id,
                'vendor_id': vendor_id,
                'error_type': type(e).__name__,
                'error_message': str(e)
            }
        })
        logger.error(f'❌ Failed to publish plans.fetch_failed event: {str(e)}', exc_info=True)
        return False


def publish_plans_fetch_completed_event(
    lead_id: str, 
    vendor_id: str,
    plan_count: int,
    fetch_request_id: str = None
) -> bool:
    """
    Publish plans.fetch_completed event to Event Grid when RPA finishes successfully
    
    Args:
        lead_id: Lead identifier
        vendor_id: Vendor identifier
        plan_count: Number of plans fetched
        fetch_request_id: Optional fetch request ID
        
    Returns:
        bool: True if event published successfully
    """
    try:
        endpoint = os.environ.get('EVENTGRID_TOPIC_ENDPOINT')
        key = os.environ.get('EVENTGRID_TOPIC_KEY')
        
        logger.info(f"[EVENT_GRID] Publishing plans.fetch_completed", extra={
            'custom_dimensions': {
                'lead_id': lead_id,
                'vendor_id': vendor_id,
                'plan_count': plan_count,
                'endpoint': endpoint[:50] if endpoint else 'NOT_SET'
            }
        })
        
        if not endpoint or not key:
            logger.error('[EVENT_GRID] Missing credentials', extra={
                'custom_dimensions': {
                    'lead_id': lead_id,
                    'vendor_id': vendor_id,
                    'has_endpoint': bool(endpoint),
                    'has_key': bool(key)
                }
            })
            logger.warning('EVENTGRID_TOPIC_ENDPOINT or EVENTGRID_TOPIC_KEY not set - skipping event')
            return False
        
        logger.info(f'Publishing plans.fetch_completed event for lead: {lead_id}')
        
        credential = AzureKeyCredential(key)
        client = EventGridPublisherClient(endpoint, credential)
        
        event = EventGridEvent(
            event_type="plans.fetch_completed",
            subject=f"plans/{lead_id}",
            data={
                "leadId": lead_id,
                "vendorId": vendor_id,
                "totalPlans": plan_count,
                "successfulVendors": [vendor_id] if plan_count > 0 else [],
                "failedVendors": [] if plan_count > 0 else [vendor_id],
                "fetchRequestId": fetch_request_id,
                "timestamp": datetime.utcnow().isoformat()
            },
            data_version="1.0"
        )
        
        client.send(event)
        
        logger.info(f"[EVENT_GRID] Event published successfully", extra={
            'custom_dimensions': {
                'lead_id': lead_id,
                'vendor_id': vendor_id,
                'plan_count': plan_count,
                'status': 'success'
            }
        })
        logger.info(f'✅ Successfully published plans.fetch_completed event')
        return True
        
    except Exception as e:
        logger.error(f"[EVENT_GRID] Publishing failed", extra={
            'custom_dimensions': {
                'lead_id': lead_id,
                'vendor_id': vendor_id,
                'error_type': type(e).__name__,
                'error_message': str(e)
            }
        })
        logger.error(f'❌ Failed to publish plans.fetch_completed event: {str(e)}', exc_info=True)
        return False


