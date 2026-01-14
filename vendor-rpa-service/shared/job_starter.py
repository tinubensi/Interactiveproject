"""
Job Starter - Azure Storage Queue client
Enqueues RPA job messages for processing by Container Apps Jobs via KEDA
"""
import os
import json
import logging
import base64
from typing import Dict
from azure.storage.queue.aio import QueueClient

logger = logging.getLogger(__name__)


async def start_container_job(vendor_id: str, lead_data: Dict) -> Dict:
    """
    Enqueue an RPA job message to Azure Storage Queue
    
    This function:
    1. Enqueues message to Azure Storage Queue
    2. KEDA triggers Container App Job based on queue depth
    3. Container reads message, executes RPA, saves plans
    4. Returns immediately after enqueuing (non-blocking)
    
    The message contains:
    - vendorId: Vendor identifier for the RPA bot
    - leadData: Full lead data dictionary
    
    KEDA will:
    - Monitor queue depth
    - Scale Container Jobs (1 job per message)
    - Pass message to container via environment variable or file mount
    
    Args:
        vendor_id: Vendor identifier (e.g., "watania", "nextcare")
        lead_data: Full lead data dictionary
        
    Returns:
        Dict with success status and message details
    """
    try:
        # Get configuration from environment
        connection_string = os.environ.get('AZURE_STORAGE_CONNECTION_STRING')
        queue_name = os.environ.get('RPA_QUEUE_NAME', 'rpa-jobs')
        
        if not connection_string:
            logger.error('AZURE_STORAGE_CONNECTION_STRING environment variable not set')
            return {
                "success": False,
                "vendor_id": vendor_id,
                "error": "AZURE_STORAGE_CONNECTION_STRING not configured"
            }
        
        logger.info(f'Enqueuing RPA job for vendor: {vendor_id}')
        logger.info(f'Queue: {queue_name}, Lead ID: {lead_data.get("id")}')
        
        # Prepare message payload
        message_payload = {
            "vendorId": vendor_id,
            "leadId": lead_data.get('id'),
            "leadData": lead_data
        }
        
        # Serialize to JSON
        message_json = json.dumps(message_payload)
        
        logger.info(f'Message prepared for {vendor_id}, payload size: {len(message_json)} bytes')
        
        # Initialize Queue Client (async)
        queue_client = QueueClient.from_connection_string(
            conn_str=connection_string,
            queue_name=queue_name
        )
        
        # Ensure queue exists (create if not)
        try:
            await queue_client.create_queue()
            logger.info(f'Queue {queue_name} created or already exists')
        except Exception as create_error:
            # Queue may already exist, log and continue
            logger.debug(f'Queue creation note: {create_error}')
        
        # Enqueue message (async)
        # Azure Queue Storage automatically base64 encodes messages
        message_response = await queue_client.send_message(message_json)
        
        message_id = message_response.id
        
        logger.info(f'✅ Message enqueued successfully for {vendor_id}')
        logger.info(f'   Message ID: {message_id}')
        logger.info(f'   Queue: {queue_name}')
        logger.info(f'   KEDA will trigger container job automatically')
        
        return {
            "success": True,
            "vendor_id": vendor_id,
            "message_id": message_id,
            "queue_name": queue_name,
            "lead_id": lead_data.get('id')
        }
        
    except Exception as e:
        logger.error(f'Failed to enqueue message for {vendor_id}: {str(e)}', exc_info=True)
        return {
            "success": False,
            "vendor_id": vendor_id,
            "error": str(e)
        }
