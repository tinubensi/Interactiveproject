"""
Queue Consumer for Azure Container Apps
Pulls messages from Azure Storage Queue and executes RPA tasks
"""
import asyncio
import os
import json
import logging
import sys
from azure.storage.queue import QueueClient
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=os.environ.get('LOG_LEVEL', 'INFO').upper(),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("QueueConsumer")


async def process_queue_message():
    """
    Pull one message from Azure Storage Queue and process it
    Retries with exponential backoff if no message found initially
    """
    connection_string = os.environ.get('AZURE_STORAGE_CONNECTION_STRING')
    queue_name = os.environ.get('VENDOR_QUEUE_NAME', 'vendor-rpa-tasks')
    max_retries = int(os.environ.get('QUEUE_MAX_RETRIES', '5'))
    initial_delay = int(os.environ.get('QUEUE_INITIAL_DELAY', '3'))
    
    if not connection_string:
        logger.error("AZURE_STORAGE_CONNECTION_STRING not set")
        sys.exit(1)
    
    # Small delay to allow message to become available
    if initial_delay > 0:
        logger.info(f"Waiting {initial_delay}s for message to become available...")
        await asyncio.sleep(initial_delay)
    
    logger.info(f"Connecting to queue: {queue_name}")
    
    try:
        # Create queue client
        queue_client = QueueClient.from_connection_string(
            conn_str=connection_string,
            queue_name=queue_name
        )
        
        # Retry logic - messages might not be immediately available
        retry_count = 0
        message_found = False
        
        while retry_count < max_retries and not message_found:
            if retry_count > 0:
                # Exponential backoff: 2, 4, 8, 16 seconds
                wait_time = min(2 ** retry_count, 16)
                logger.info(f"Retry {retry_count}/{max_retries} - waiting {wait_time}s...")
                await asyncio.sleep(wait_time)
            
            # Get one message (with 10 minute visibility timeout)
            logger.info(f"Checking queue for messages (attempt {retry_count + 1}/{max_retries})...")
            messages = queue_client.receive_messages(messages_per_page=1, visibility_timeout=600)
            
            for message in messages:
                message_found = True
                logger.info(f"Received message ID: {message.id}")
                
                try:
                    # Parse message content
                    task_data = json.loads(message.content)
                    logger.info(f"Processing task for vendor: {task_data.get('vendorId')}")
                    
                    # Set environment variables for executor
                    os.environ['VENDOR_ID'] = task_data.get('vendorId', '')
                    os.environ['TASK_DATA'] = json.dumps(task_data)
                    os.environ['WEBHOOK_URL'] = task_data.get('webhookUrl', '')
                    os.environ['ORCHESTRATION_ID'] = task_data.get('orchestrationId', '')
                    
                    # Import and execute RPA task
                    sys.path.insert(0, '/app')
                    from container.executor import execute_rpa_task
                    
                    logger.info("Starting RPA execution...")
                    await execute_rpa_task()
                    logger.info("RPA execution completed successfully")
                    
                    # Delete message from queue (mark as processed)
                    logger.info(f"Deleting message {message.id} from queue")
                    queue_client.delete_message(message.id, message.pop_receipt)
                    logger.info("Message deleted successfully")
                    
                    # Exit with success
                    sys.exit(0)
                    
                except Exception as e:
                    logger.error(f"Error processing message: {e}", exc_info=True)
                    
                    # Don't delete message - let it become visible again for retry
                    logger.warning(f"Message will be retried after visibility timeout")
                    
                    # Exit with error
                    sys.exit(1)
            
            # No message found in this attempt
            if not message_found:
                retry_count += 1
        
        if not message_found:
            logger.warning(f"No messages found after {max_retries} attempts - container will exit")
            # This is normal - KEDA scaled up but message was already processed
            # Or queue is genuinely empty
            sys.exit(0)
    
    except Exception as e:
        logger.error(f"Queue consumer error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    logger.info("Queue Consumer starting...")
    logger.info(f"Queue: {os.environ.get('VENDOR_QUEUE_NAME', 'vendor-rpa-tasks')}")
    
    try:
        asyncio.run(process_queue_message())
    except KeyboardInterrupt:
        logger.info("Received interrupt signal")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
