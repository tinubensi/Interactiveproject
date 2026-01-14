"""
Continuous Queue Consumer for Azure Container Apps
Polls Azure Storage Queue continuously and executes RPA tasks
"""
import asyncio
import os
import json
import logging
import sys
from azure.storage.queue import QueueClient
from azure.cosmos import CosmosClient
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=os.environ.get('LOG_LEVEL', 'INFO').upper(),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ContinuousQueueConsumer")

def log_to_cosmos_sync(stage, status, message, details=None):
    try:
        conn_str = os.environ.get('COSMOS_CONNECTION_STRING')
        if not conn_str:
            logger.warning("COSMOS_CONNECTION_STRING not set, cannot log to DB")
            return
        
        client = CosmosClient.from_connection_string(conn_str)
        db = client.get_database_client('lead-service-db')
        container = db.get_container_client('vendorExecutions')
        
        doc = {
            "id": f"queue_consumer_{int(datetime.utcnow().timestamp()*1000)}",
            "vendorId": "system",
            "executionType": "diagnostic",
            "stage": stage,
            "status": status,
            "message": message,
            "details": details or {},
            "timestamp": datetime.utcnow().isoformat()
        }
        container.create_item(doc)
    except Exception as e:
        logger.error(f"Failed to log to Cosmos: {e}")

async def process_single_message(queue_client, message):
    """Process a single message from the queue"""
    logger.info(f"✓ Received message ID: {message.id}")
    log_to_cosmos_sync("queue_processing", "started", f"Processing message {message.id}")
    
    try:
        # Parse message content
        task_data = json.loads(message.content)
        
        # Handle Event Grid wrapping (e.g. {"id": "...", "data": {...}})
        if 'data' in task_data and 'vendorId' not in task_data:
            logger.info("Detected Event Grid wrapped message, extracting data payload")
            task_data = task_data['data']
            
        logger.info(f"Processing task for vendor: {task_data.get('vendorId')}")
        
        # Set environment variables for executor
        os.environ['VENDOR_ID'] = task_data.get('vendorId', '')
        os.environ['TASK_DATA'] = json.dumps(task_data)
        os.environ['LEAD_DATA'] = json.dumps(task_data.get('leadData', {}))  # executor.py expects this
        os.environ['WEBHOOK_URL'] = task_data.get('callbackUrl', '')
        os.environ['ORCHESTRATION_ID'] = task_data.get('orchestrationId', '')
        
        # Import and execute RPA task
        sys.path.insert(0, '/app')
        from container.executor import execute_rpa_task
        
        logger.info("🤖 Starting RPA execution...")
        await execute_rpa_task()
        logger.info("✓ RPA execution completed successfully")
        
        # Delete message from queue (mark as processed)
        logger.info(f"Deleting message {message.id} from queue")
        queue_client.delete_message(message.id, message.pop_receipt)
        logger.info("✓ Message deleted successfully")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error processing message: {e}", exc_info=True)
        log_to_cosmos_sync("queue_processing", "error", f"Error processing message: {str(e)}")
        # Don't delete message - let it become visible again for retry
        logger.warning(f"Message will be retried after visibility timeout")
        return False


async def continuous_poll():
    """
    Continuously poll the queue for messages and process them
    """
    connection_string = os.environ.get('AZURE_STORAGE_CONNECTION_STRING')
    # Support both QUEUE_NAME (Container App Job) and VENDOR_QUEUE_NAME (Legacy)
    queue_name = os.environ.get('QUEUE_NAME', os.environ.get('VENDOR_QUEUE_NAME', 'vendor-rpa-tasks'))
    poll_interval = int(os.environ.get('QUEUE_POLL_INTERVAL', '5'))
    
    if not connection_string:
        logger.error("AZURE_STORAGE_CONNECTION_STRING not set")
        sys.exit(1)
    
    logger.info(f"🚀 Continuous Queue Consumer starting...")
    log_to_cosmos_sync("startup", "started", "Queue Consumer starting")
    logger.info(f"📊 Queue: {queue_name}")
    logger.info(f"⏱️  Poll Interval: {poll_interval}s")
    
    # Create queue client
    queue_client = QueueClient.from_connection_string(
        conn_str=connection_string,
        queue_name=queue_name
    )
    
    consecutive_empty_polls = 0
    max_empty_polls = int(os.environ.get('MAX_EMPTY_POLLS', '120'))  # 10 minutes at 5s interval
    
    while True:
        try:
            # Get messages from queue
            messages = queue_client.receive_messages(
                messages_per_page=1,
                visibility_timeout=600  # 10 minutes
            )
            
            message_found = False
            for message in messages:
                message_found = True
                consecutive_empty_polls = 0  # Reset counter
                
                # Process the message
                success = await process_single_message(queue_client, message)
                
                if not success:
                    logger.warning("Message processing failed, continuing...")
            
            if not message_found:
                consecutive_empty_polls += 1
                if consecutive_empty_polls % 12 == 0:  # Log every minute
                    logger.info(f"No messages ({consecutive_empty_polls}/{max_empty_polls} empty polls)")
                
                # Scale to zero after prolonged inactivity
                if consecutive_empty_polls >= max_empty_polls:
                    logger.info(f"✓ No messages for {max_empty_polls * poll_interval}s - scaling down")
                    sys.exit(0)
            
            # Wait before next poll
            await asyncio.sleep(poll_interval)
            
        except KeyboardInterrupt:
            logger.info("Received interrupt signal")
            break
        except Exception as e:
            logger.error(f"Error in polling loop: {e}", exc_info=True)
            await asyncio.sleep(poll_interval)


if __name__ == "__main__":
    try:
        asyncio.run(continuous_poll())
    except KeyboardInterrupt:
        logger.info("Shutting down gracefully")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)

