"""
Vendor RPA Service - FastAPI Application
Orchestrates quote fetching from 27 vendor portals using Container Apps
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from azure.storage.queue import QueueClient, QueueServiceClient
from azure.cosmos import CosmosClient
import os
import json
import uuid
from datetime import datetime
from typing import Dict, List
import logging
import asyncio
import subprocess
import httpx

from models import (
    GetQuotesRequest,
    GetQuotesResponse,
    StandardLead,
    VendorResult,
    OrchestrationStatus,
    VendorTaskPayload
)
from pydantic import BaseModel
from typing import Optional, Any
from orchestrator import OrchestrationManager
from vendor_loader import load_vendor_list

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="Vendor RPA Service",
    description="Automated insurance quote fetching from vendor portals",
    version="2.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
storage_connection_string = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
cosmos_endpoint = os.getenv('COSMOS_DB_ENDPOINT')
cosmos_key = os.getenv('COSMOS_DB_KEY')
api_base_url = os.getenv('API_BASE_URL', 'http://localhost:8000')

# Orchestration manager
orchestration_manager = OrchestrationManager(
    storage_connection=storage_connection_string,
    cosmos_endpoint=cosmos_endpoint,
    cosmos_key=cosmos_key
)


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "Vendor RPA Service",
        "status": "healthy",
        "version": "2.0.0"
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    health_status = {
        "service": "healthy",
        "storage": "unknown",
        "cosmos": "unknown"
    }
    
    # Check storage connection
    try:
        queue_service = QueueServiceClient.from_connection_string(storage_connection_string)
        queue_service.get_service_properties()
        health_status["storage"] = "healthy"
    except Exception as e:
        health_status["storage"] = f"unhealthy: {str(e)}"
    
    # Check Cosmos DB connection
    try:
        if cosmos_endpoint and cosmos_key:
            cosmos_client = CosmosClient(cosmos_endpoint, cosmos_key)
            # Simple check - list databases
            list(cosmos_client.list_databases())
            health_status["cosmos"] = "healthy"
    except Exception as e:
        health_status["cosmos"] = f"unhealthy: {str(e)}"
    
    return health_status


@app.post("/api/quotes", response_model=GetQuotesResponse)
async def start_quotes(request: GetQuotesRequest, background_tasks: BackgroundTasks):
    """
    Start quote fetching orchestration
    
    Flow:
    1. Map Lead to StandardLead
    2. Load vendor list for LOB
    3. Create orchestration record
    4. Push tasks to queue (Fan-Out)
    5. Return orchestration ID for status tracking
    """
    try:
        logger.info(f"Received quote request for lead: {request.lead.get('id')}")
        
        # 1. Map Lead to StandardLead
        standard_lead = map_lead_to_standard(request.lead)
        logger.info(f"Mapped to StandardLead: {standard_lead.leadId}, LOB: {standard_lead.lineOfBusiness}")
        
        # 2. Load vendor list
        lob = standard_lead.lineOfBusiness
        all_vendors = load_vendor_list(lob)
        
        # Filter to specific vendors if requested
        if request.vendorIds:
            vendors = [v for v in all_vendors if v['id'] in request.vendorIds]
        else:
            vendors = [v for v in all_vendors if v.get('enabled', True)]
        
        if not vendors:
            raise HTTPException(status_code=400, detail="No enabled vendors found for this line of business")
        
        logger.info(f"Found {len(vendors)} vendors for {lob}")
        
        # 3. Create orchestration
        orchestration_id = str(uuid.uuid4())
        callback_url = f"{api_base_url}/api/callback"
        
        # Save orchestration state
        await orchestration_manager.create_orchestration(
            orchestration_id=orchestration_id,
            standard_lead=standard_lead,
            vendor_ids=[v['id'] for v in vendors]
        )
        
        # 4. Push tasks to queue (Fan-Out) in background
        background_tasks.add_task(
            push_vendor_tasks,
            orchestration_id,
            standard_lead,
            vendors,
            callback_url
        )
        
        logger.info(f"Created orchestration {orchestration_id} with {len(vendors)} vendors")
        
        # 5. Return orchestration info
        return GetQuotesResponse(
            orchestrationId=orchestration_id,
            status="running",
            statusQueryGetUri=f"/api/quotes/{orchestration_id}",
            totalVendors=len(vendors),
            message=f"Started fetching quotes from {len(vendors)} vendors"
        )
        
    except Exception as e:
        logger.error(f"Error starting quotes: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/quotes/{orchestration_id}", response_model=OrchestrationStatus)
async def get_orchestration_status(orchestration_id: str):
    """
    Get orchestration status and results
    
    Returns current status, completed vendors, and fetched plans
    """
    try:
        status = await orchestration_manager.get_status(orchestration_id)
        
        if not status:
            raise HTTPException(status_code=404, detail="Orchestration not found")
        
        return status
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting status: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/eventgrid/webhook")
async def handle_event_grid_webhook(events: List[dict]):
    """
    Handle Event Grid webhook for lead.created events
    This replaces the Azure Storage Queue approach
    
    Event Grid sends events in this format:
    [{
        "id": "uuid",
        "eventType": "lead.created",
        "subject": "/leads/123",
        "eventTime": "2025-01-01T00:00:00Z",
        "data": { ... lead data ... }
    }]
    """
    try:
        logger.info(f"Received {len(events)} Event Grid event(s)")
        
        for event in events:
            # Event Grid validation handshake
            if event.get('eventType') == 'Microsoft.EventGrid.SubscriptionValidationEvent':
                validation_code = event['data']['validationCode']
                logger.info(f"Event Grid validation request received")
                return {"validationResponse": validation_code}
            
            # Handle lead.created event
            if event.get('eventType') == 'lead.created':
                lead_data = event.get('data', {})
                logger.info(f"Processing lead.created event for lead: {lead_data.get('leadId')}")
                
                # Map lead data to StandardLead
                standard_lead = map_lead_to_standard(lead_data)
                
                # Get applicable vendors for this LOB
                vendors = load_vendor_list(standard_lead.lineOfBusiness)
                
                if not vendors:
                    logger.warning(f"No enabled vendors found for {standard_lead.lineOfBusiness}")
                    continue
                
                # Create orchestration
                orchestration_id = str(uuid.uuid4())
                callback_url = f"{api_base_url}/api/callback"
                
                await orchestration_manager.create_orchestration(
                    orchestration_id=orchestration_id,
                    standard_lead=standard_lead,
                    vendor_ids=[v['id'] for v in vendors]
                )
                
                logger.info(f"Created orchestration {orchestration_id} for {len(vendors)} vendors")
                
                # DIRECT EXECUTION - Bypass queue entirely!
                # Execute RPA for each vendor immediately in background
                for vendor in vendors:
                    vendor_id = vendor['id']
                    logger.info(f"🚀 Triggering DIRECT execution for vendor: {vendor_id}")
                    
                    # Execute RPA in background task
                    asyncio.create_task(
                        execute_vendor_rpa_direct(
                            vendor_id=vendor_id,
                            standard_lead=standard_lead,
                            orchestration_id=orchestration_id,
                            callback_url=callback_url
                        )
                    )
                
                logger.info(f"✅ Successfully triggered DIRECT RPA execution for {len(vendors)} vendors")
        
        return {"status": "ok", "processed": len(events)}
        
    except Exception as e:
        logger.error(f"Error processing Event Grid webhook: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/callback")
async def receive_vendor_result(result: VendorResult):
    """
    Receive webhook callback from RPA containers (Fan-In)
    
    Flow:
    1. Validate orchestration exists
    2. Store vendor result
    3. Check if all vendors complete
    4. If complete, aggregate results
    """
    try:
        logger.info(f"Received result from vendor {result.vendorId} for orchestration {result.orchestrationId}")
        
        # Store result
        await orchestration_manager.add_result(
            orchestration_id=result.orchestrationId,
            vendor_id=result.vendorId,
            result=result
        )
        
        # Check if orchestration complete
        status = await orchestration_manager.get_status(result.orchestrationId)
        
        if status.completedVendors >= status.totalVendors:
            logger.info(f"Orchestration {result.orchestrationId} completed: {status.successfulVendors}/{status.totalVendors} successful")
            
            # Mark as completed
            await orchestration_manager.complete_orchestration(result.orchestrationId)
        
        return {"status": "ok", "message": f"Result received for {result.vendorId}"}
        
    except Exception as e:
        logger.error(f"Error processing callback: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/vendors")
async def list_vendors(lob: str = None):
    """List all vendors or vendors for a specific line of business"""
    try:
        vendors = load_vendor_list(lob)
        return {
            "lineOfBusiness": lob or "all",
            "totalVendors": len(vendors),
            "vendors": vendors
        }
    except Exception as e:
        logger.error(f"Error listing vendors: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


async def push_vendor_tasks(
    orchestration_id: str,
    standard_lead: StandardLead,
    vendors: List[Dict],
    callback_url: str
):
    """
    Push vendor tasks to queue (Fan-Out)
    Each task will be picked up by Container Apps
    """
    try:
        # Get queue client
        queue_name = os.getenv('VENDOR_QUEUE_NAME', 'vendor-rpa-tasks')
        queue_client = QueueClient.from_connection_string(
            storage_connection_string,
            queue_name
        )
        
        # Create queue if it doesn't exist
        try:
            queue_client.create_queue()
        except Exception:
            pass  # Queue already exists
        
        # Push each vendor task
        for vendor in vendors:
            task_payload = VendorTaskPayload(
                vendorId=vendor['id'],
                standardLead=standard_lead,
                orchestrationId=orchestration_id,
                callbackUrl=callback_url,
                timeout=vendor.get('timeout', 90)
            )
            
            # Convert to JSON and send to queue
            message_content = task_payload.model_dump_json()
            # Set visibility_timeout=0 (immediately visible) and time_to_live=600 (10 minutes)
            queue_client.send_message(
                message_content,
                visibility_timeout=0,
                time_to_live=600
            )
            
            logger.info(f"Pushed task for vendor {vendor['id']} to queue (immediately visible)")
            
            # Small delay to allow message to propagate in Azure Storage Queue
            await asyncio.sleep(3)
        
        logger.info(f"Successfully pushed {len(vendors)} tasks to queue")
        
    except Exception as e:
        logger.error(f"Error pushing tasks to queue: {str(e)}", exc_info=True)
        # Mark orchestration as failed
        await orchestration_manager.fail_orchestration(orchestration_id, str(e))


def map_lead_to_standard(lead: Dict) -> StandardLead:
    """Map full Lead object to StandardLead"""
    return StandardLead(
        leadId=lead['id'],
        firstName=lead.get('firstName', ''),
        lastName=lead.get('lastName', ''),
        fullName=f"{lead.get('firstName', '')} {lead.get('lastName', '')}".strip(),
        email=lead.get('email', ''),
        phone=lead.get('phone', {}),
        emirate=lead.get('emirate', ''),
        lineOfBusiness=lead.get('lineOfBusiness', ''),
        businessType=lead.get('businessType', ''),
        dob=lead.get('dob', ''),
        gender=lead.get('gender', ''),
        lobData=lead.get('lobData'),
        createdAt=lead.get('createdAt')
    )


async def execute_vendor_rpa_direct(
    vendor_id: str,
    standard_lead: StandardLead,
    orchestration_id: str,
    callback_url: str
):
    """
    Execute RPA directly without queue (Event Grid Direct Execution)
    This bypasses Azure Storage Queue entirely for 100% reliability
    """
    try:
        logger.info(f"🤖 Starting DIRECT RPA execution for vendor: {vendor_id}")
        
        # Import executor functions
        import sys
        import subprocess
        
        # Prepare task data
        task_data = {
            "vendorId": vendor_id,
            "standardLead": standard_lead.model_dump(),
            "orchestrationId": orchestration_id,
            "callbackUrl": callback_url
        }
        
        # Execute RPA in subprocess to isolate execution
        env = os.environ.copy()
        env['VENDOR_ID'] = vendor_id
        env['TASK_DATA'] = json.dumps(task_data)
        env['WEBHOOK_URL'] = callback_url
        env['ORCHESTRATION_ID'] = orchestration_id
        env['PYTHONPATH'] = '/home/janees/Desktop/crm/vendor-rpa-service'
        
        # Run executor
        executor_path = '/home/janees/Desktop/crm/vendor-rpa-service/container/executor.py'
        
        logger.info(f"Executing RPA for {vendor_id} in subprocess...")
        
        # Run in background with asyncio
        proc = await asyncio.create_subprocess_exec(
            'python3', executor_path,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        logger.info(f"✅ RPA execution started for {vendor_id} (PID: {proc.pid})")
        
        # Wait for completion and log output
        stdout, stderr = await proc.communicate()
        
        if stdout:
            logger.info(f"RPA {vendor_id} output: {stdout.decode()[:500]}")
        if stderr:
            logger.error(f"RPA {vendor_id} errors: {stderr.decode()[:500]}")
        
        logger.info(f"✅ RPA execution completed for {vendor_id} (exit code: {proc.returncode})")
        
    except Exception as e:
        logger.error(f"❌ Error in direct RPA execution for {vendor_id}: {e}", exc_info=True)
        
        # Send failure webhook
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                await client.post(
                    callback_url,
                    json={
                        "orchestrationId": orchestration_id,
                        "vendorId": vendor_id,
                        "success": False,
                        "plans": [],
                        "error": str(e)
                    },
                    timeout=10
                )
        except:
            pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

