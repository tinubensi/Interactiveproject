"""
Container Executor for RPA Tasks
Main entry point for containerized RPA execution - dynamically loads vendor bots
Saves plans directly to Cosmos DB after extraction
"""
import asyncio
import os
import json
import logging
from datetime import datetime
from typing import List, Dict

# Import the vendor registry
from vendors import vendor_registry

# Import Cosmos DB client
from azure.cosmos import CosmosClient, exceptions
# Import Queue client
from azure.storage.queue import QueueClient

# Import Event Grid publisher
from shared.eventgrid_publisher import publish_plans_fetch_failed_event, publish_plans_fetch_completed_event

import traceback

# Setup logging
logging.basicConfig(
    level=os.environ.get('LOG_LEVEL', 'INFO').upper(),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ContainerExecutor")

# Setup Application Insights if connection string available
try:
    from opencensus.ext.azure.log_exporter import AzureLogHandler
    app_insights_conn = os.environ.get('APPLICATIONINSIGHTS_CONNECTION_STRING')
    if app_insights_conn:
        logger.addHandler(AzureLogHandler(connection_string=app_insights_conn))
        logger.info("✅ Application Insights logging enabled")
    else:
        logger.warning("⚠️ APPLICATIONINSIGHTS_CONNECTION_STRING not set - logs won't be sent to Azure")
except ImportError:
    logger.warning("⚠️ opencensus-ext-azure not installed - Application Insights logging disabled")


async def save_plans_to_cosmos(lead_id: str, vendor_id: str, plans: List[Dict]):
    """
    Save plans directly to Cosmos DB
    
    Args:
        lead_id: Lead ID to associate plans with
        vendor_id: Vendor ID
        plans: List of StandardPlan dictionaries
    """
    cosmos_connection_string = os.environ.get('COSMOS_CONNECTION_STRING')
    
    if not cosmos_connection_string:
        logger.error("❌ COSMOS_CONNECTION_STRING not set in environment")
        raise ValueError("COSMOS_CONNECTION_STRING is required")
    
    logger.info(f"[COSMOS_DB] Saving plans", extra={
        'custom_dimensions': {
            'lead_id': lead_id,
            'vendor_id': vendor_id,
            'plan_count': len(plans)
        }
    })
    logger.info(f"💾 Saving {len(plans)} plans to Cosmos DB for lead {lead_id}")
    
    try:
        # Initialize Cosmos client
        cosmos_client = CosmosClient.from_connection_string(cosmos_connection_string)
        
        # Get database and container - use lead-service-db where Lead Service stores plans
        database = cosmos_client.get_database_client('lead-service-db')
        container = database.get_container_client('plans')
        
        saved_count = 0
        
        # Save each plan
        for plan in plans:
            plan_code = plan.get('planCode', 'unknown')
            plan_id = f"{lead_id}_{vendor_id}_{plan_code}"
            
            plan_doc = {
                "id": plan_id,
                "type": "plan",  # Set type field for querying
                "leadId": lead_id,
                "vendorId": vendor_id,
                "fetchedAt": datetime.utcnow().isoformat(),
                **plan  # Spread all plan fields
            }
            
            try:
                # Upsert plan (create or update if exists)
                # Note: Cosmos SDK is synchronous but network I/O is fast
                container.upsert_item(plan_doc)
                saved_count += 1
                logger.info(f"  ✅ Saved plan: {plan_id}")
            
            except Exception as e:
                logger.error(f"  ❌ Failed to save plan {plan_id}: {str(e)}")
                # Continue with other plans even if one fails
        
        logger.info(f"[COSMOS_DB] Save complete", extra={
            'custom_dimensions': {
                'lead_id': lead_id,
                'vendor_id': vendor_id,
                'saved': saved_count,
                'total': len(plans)
            }
        })
        logger.info(f"✅ Successfully saved {saved_count}/{len(plans)} plans to Cosmos DB")
        
        return saved_count
    
    except exceptions.CosmosHttpResponseError as e:
        logger.error(f"[COSMOS_DB] Save failed", extra={
            'custom_dimensions': {
                'lead_id': lead_id,
                'vendor_id': vendor_id,
                'error': str(e.message if hasattr(e, 'message') else e)
            }
        })
        logger.error(f"❌ Cosmos DB error: {e.message if hasattr(e, 'message') else e}", exc_info=True)
        raise
    
    except Exception as e:
        logger.error(f"[COSMOS_DB] Save failed", extra={
            'custom_dimensions': {
                'lead_id': lead_id,
                'vendor_id': vendor_id,
                'error': str(e)
            }
        })
        logger.error(f"❌ Failed to save plans to Cosmos DB: {str(e)}", exc_info=True)
        raise


async def save_diagnostic_to_cosmos(
    lead_id: str,
    vendor_id: str,
    stage: str,
    status: str,
    message: str,
    details: dict = None
):
    """
    Save diagnostic info to vendorExecutions container (non-blocking)
    This is called at each stage of execution for debugging and monitoring
    Runs in thread pool to avoid blocking the event loop
    """
    try:
        cosmos_conn = os.environ.get('COSMOS_CONNECTION_STRING')
        if not cosmos_conn:
            logger.warning("Cannot save diagnostic: COSMOS_CONNECTION_STRING not set")
            return  # Can't save without connection
        
        # Run Cosmos DB operation in thread pool to avoid blocking event loop
        def _save_diagnostic_sync():
            try:
                client = CosmosClient.from_connection_string(cosmos_conn)
                db = client.get_database_client('lead-service-db')
                container = db.get_container_client('vendorExecutions')
                
                diagnostic_doc = {
                    "id": f"diagnostic_{lead_id}_{vendor_id}_{stage}_{int(datetime.utcnow().timestamp()*1000)}",
                    "leadId": lead_id,
                    "vendorId": vendor_id,
                    "executionType": "diagnostic",
                    "stage": stage,
                    "status": status,
                    "message": message,
                    "details": details or {},
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                container.create_item(diagnostic_doc)
                logger.debug(f"✅ Diagnostic saved: [{stage}] {status} - {message}")
            except Exception as e:
                logger.debug(f"❌ Failed to save diagnostic for stage '{stage}': {e}")
        
        # Run in thread pool with timeout to prevent hanging
        # Use run_in_executor for Python 3.7+ compatibility (to_thread requires 3.9+)
        loop = asyncio.get_event_loop()
        await asyncio.wait_for(
            loop.run_in_executor(None, _save_diagnostic_sync),
            timeout=5.0  # 5 second timeout for diagnostic saves
        )
    except asyncio.TimeoutError:
        logger.debug(f"⚠️ Diagnostic save timeout for stage '{stage}' - skipping")
    except Exception as e:
        logger.debug(f"❌ Failed to save diagnostic for stage '{stage}': {e}")


async def verify_container_health():
    """
    Verify container environment before starting RPA
    Checks all prerequisites: connections, credentials, and browser availability
    """
    health = {
        "cosmos_connection": bool(os.environ.get('COSMOS_CONNECTION_STRING')),
        "storage_connection": bool(os.environ.get('AZURE_STORAGE_CONNECTION_STRING')),
        "vendor_credentials": bool(os.environ.get('VENDOR_CREDENTIALS')),
        "playwright_installed": False,
        "chromium_available": False
    }
    
    # Check Playwright and Chromium
    try:
        from playwright.async_api import async_playwright
        health["playwright_installed"] = True
        logger.info("✅ Playwright is installed")
        
        # Quick browser test (launch and close)
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                await browser.close()
                health["chromium_available"] = True
                logger.info("✅ Chromium browser is available")
        except Exception as browser_error:
            health["chromium_error"] = str(browser_error)
            logger.error(f"❌ Chromium browser test failed: {browser_error}")
    except Exception as pw_error:
        health["playwright_error"] = str(pw_error)
        logger.error(f"❌ Playwright import failed: {pw_error}")
    
    return health


async def execute_rpa_task():
    """
    Main execution function for RPA task in container
    Reads from Event Grid event or environment variables, executes RPA, saves plans directly to Cosmos DB
    """
    lead_id = "unknown"
    vendor_id = "unknown"
    
    # DIAGNOSTIC STAGE 1: Container startup
    try:
        await save_diagnostic_to_cosmos(
            "startup", "startup", "container_start", "started",
            "Container executor started",
            {"env_vars": [k for k in os.environ.keys() if k not in ['PATH', 'HOME', 'HOSTNAME']]}
        )
    except Exception as diag_error:
        logger.error(f"Failed to save startup diagnostic: {diag_error}")
    
    # Health check - verify environment and dependencies
    logger.info("🏥 Running container health check...")
    health = await verify_container_health()
    
    # Save health check results
    try:
        await save_diagnostic_to_cosmos(
            "startup", "startup", "health_check", "completed",
            "Container health check completed",
            health
        )
    except Exception as diag_error:
        logger.error(f"Failed to save health check diagnostic: {diag_error}")
    
    # Check critical requirements
    if not health["chromium_available"]:
        error_msg = "Chromium browser not available - cannot proceed with RPA"
        logger.error(f"❌ {error_msg}")
        try:
            await save_diagnostic_to_cosmos(
                "startup", "startup", "health_check", "failed",
                error_msg,
                health
            )
        except:
            pass
        raise RuntimeError(error_msg)
    
    if not health["cosmos_connection"]:
        logger.warning("⚠️ COSMOS_CONNECTION_STRING not set - cannot save plans")
    
    logger.info("✅ Health check passed")
    
    # Log all environment variables to debug (including non-AZURE ones)
    logger.info("🔍 All environment variables:")
    for key in sorted(os.environ.keys()):
        if key not in ['PATH', 'HOME', 'HOSTNAME']:  # Skip common system vars
            value = os.environ[key]
            value_preview = value[:200] + '...' if len(value) > 200 else value
            logger.info(f"  {key}: {value_preview}")
    
    # Try multiple possible environment variable formats
    vendor_id = None
    lead_data = None
    
    # Format 0: RPA_MESSAGE_DATA (From Azure Function execution - HIGHEST PRIORITY)
    import base64
    rpa_message_base64 = os.environ.get('RPA_MESSAGE_DATA')
    if rpa_message_base64:
        logger.info("📨 Found RPA_MESSAGE_DATA from Azure Function")
        try:
            # Decode base64
            message_json = base64.b64decode(rpa_message_base64).decode('utf-8')
            message_data = json.loads(message_json)
            
            vendor_id = message_data.get('vendorId')
            lead_data = message_data.get('leadData')
            
            logger.info(f"✅ Parsed from RPA_MESSAGE_DATA: vendor={vendor_id}, lead={lead_data.get('id') if lead_data else None}")
        except Exception as e:
            logger.error(f"❌ Failed to parse RPA_MESSAGE_DATA: {e}")
    
    # Format 1: AZURE_CONTAINERAPP_EVENT_DATA (Event Grid)
    event_data_str = os.environ.get('AZURE_CONTAINERAPP_EVENT_DATA')
    if event_data_str:
        logger.info("📨 Found AZURE_CONTAINERAPP_EVENT_DATA")
        try:
            event_wrapper = json.loads(event_data_str)
            if 'data' in event_wrapper:
                event_data = event_wrapper.get('data', {})
            else:
                event_data = event_wrapper
            vendor_id = event_data.get('vendorId')
            lead_data = event_data.get('leadData')
            logger.info(f"✅ Parsed from AZURE_CONTAINERAPP_EVENT_DATA: vendor={vendor_id}, lead={lead_data.get('id') if lead_data else None}")
        except Exception as e:
            logger.error(f"❌ Failed to parse AZURE_CONTAINERAPP_EVENT_DATA: {e}")
    
    # Format 2: Check for base64 encoded queue message (common with Storage Queue)
    if not vendor_id:
        import base64
        
        # Check explicit message sources first
        message_sources = [
            # 1. File mount (highest priority)
            ('/mnt/azure-queue/message', 'file'),
            # 2. Specific env vars
            ('AZURE_CONTAINER_APP_JOB_MESSAGE', 'env'),
            ('QUEUE_MESSAGE', 'env')
        ]
        
        # Check other env vars dynamically
        for key in os.environ.keys():
            if ('QUEUE' in key.upper() or 'MESSAGE' in key.upper()) and key not in ['AZURE_CONTAINER_APP_JOB_MESSAGE', 'QUEUE_MESSAGE']:
                message_sources.append((key, 'env'))
        
        for source, source_type in message_sources:
            try:
                raw_value = None
                
                if source_type == 'file':
                    if os.path.exists(source):
                        logger.info(f"📨 Found message file at {source}")
                        with open(source, 'r') as f:
                            raw_value = f.read().strip()
                else:
                    # env var
                    if source in os.environ:
                        logger.info(f"📨 Found message env var: {source}")
                        raw_value = os.environ[source]
                
                if not raw_value:
                    continue
                    
                # Try to parse the value
                # It could be:
                # 1. Plain JSON
                # 2. Base64 encoded JSON
                # 3. Queue message object wrapper
                
                # Helper to extract vendor/lead from dict
                def extract_data(d):
                    v_id = d.get('vendorId')
                    l_data = d.get('leadData')
                    
                    # Also check nested 'data' field (Event Grid structure)
                    if not v_id and 'data' in d:
                        v_id = d['data'].get('vendorId')
                        l_data = d['data'].get('leadData')
                        
                    return v_id, l_data

                # Try direct JSON
                try:
                    data = json.loads(raw_value)
                    v_id, l_data = extract_data(data)
                    if v_id:
                        vendor_id = v_id
                        lead_data = l_data
                        logger.info(f"✅ Parsed from {source} (JSON): vendor={vendor_id}")
                        break
                except:
                    pass
                    
                # Try Base64
                try:
                    decoded = base64.b64decode(raw_value).decode('utf-8')
                    data = json.loads(decoded)
                    v_id, l_data = extract_data(data)
                    if v_id:
                        vendor_id = v_id
                        lead_data = l_data
                        logger.info(f"✅ Parsed from {source} (Base64): vendor={vendor_id}")
                        break
                except:
                    pass
                    
            except Exception as e:
                logger.debug(f"Failed to parse from {source}: {e}")
                
    # Format 3: Queue Polling (Fallback)
    if not vendor_id:
        # If message not passed directly, try to pull from queue
        # This handles cases where KEDA triggers the job but platform doesn't inject the message
        queue_conn = os.environ.get('AZURE_STORAGE_CONNECTION_STRING')
        queue_name = os.environ.get('QUEUE_NAME', 'rpa-jobs')
        
        if queue_conn:
            logger.info(f"📨 Attempting to poll queue {queue_name} directly...")
            try:
                queue_client = QueueClient.from_connection_string(conn_str=queue_conn, queue_name=queue_name)
                
                # Receive one message with short visibility timeout (we'll delete it if successful)
                # Note: This is a race condition with other replicas if not careful, 
                # but with KEDA 1:1 scaling and fast consumption, it usually works.
                messages = queue_client.receive_messages(messages_per_page=1, visibility_timeout=300)
                
                for msg in messages:
                    logger.info(f"📨 Received message {msg.id} from queue")
                    
                    try:
                        # Parse message content
                        # Queue messages are often base64 encoded
                        content = msg.content
                        try:
                            # Try decoding first (most common for Azure Queue)
                            content = base64.b64decode(content).decode('utf-8')
                        except:
                            pass # Use as-is
                            
                        data = json.loads(content)
                        
                        # Extract data
                        if 'data' in data:
                            data = data['data']
                            
                        vendor_id = data.get('vendorId')
                        lead_data = data.get('leadData')
                        
                        if vendor_id:
                            logger.info(f"✅ Parsed from queue message: vendor={vendor_id}")
                            
                            # Ensure lead_data is a dict (handle double encoding)
                            if isinstance(lead_data, str):
                                logger.info("⚠️ lead_data is a string, attempting to parse as JSON")
                                try:
                                    lead_data = json.loads(lead_data)
                                except Exception as json_e:
                                    logger.error(f"Failed to parse lead_data string: {json_e}")

                            # IMPORTANT: Delete message so other jobs don't process it
                            queue_client.delete_message(msg)
                            logger.info(f"🗑️ Deleted message {msg.id}")
                            break
                    except Exception as parse_e:
                        logger.error(f"Failed to parse queue message: {parse_e}")
                        
            except Exception as e:
                logger.error(f"❌ Failed to poll queue: {e}")

    # Format 4: Legacy VENDOR_ID and LEAD_DATA (fallback)
    if not vendor_id:
        logger.info("📨 Trying legacy VENDOR_ID/LEAD_DATA format")
        vendor_id = os.environ.get('VENDOR_ID')
        lead_data_str = os.environ.get('LEAD_DATA')
        if lead_data_str:
            try:
                lead_data = json.loads(lead_data_str)
                logger.info(f"✅ Parsed from VENDOR_ID/LEAD_DATA: vendor={vendor_id}")
            except Exception as e:
                logger.error(f"❌ Failed to parse LEAD_DATA: {e}")
    
    credentials_str = os.environ.get('VENDOR_CREDENTIALS', '{}')
    
    if not vendor_id or not lead_data:
        logger.warning("⚠️ No vendor_id or lead_data found - likely no message in queue")
        logger.info("Exiting gracefully (no work to do)")
        # Exit silently without saving diagnostics - this is normal when queue is empty
        return
    
    # Extract lead_id early for diagnostics
    lead_id = lead_data.get('id') or lead_data.get('leadId') or "unknown"
    
    # DIAGNOSTIC STAGE 2: Environment parsing successful
    await save_diagnostic_to_cosmos(
        lead_id, vendor_id, "parsing", "success",
        "Environment variables parsed successfully",
        {"vendor_id": vendor_id, "lead_id": lead_id}
    )
    
    logger.info(f"🚀 Starting RPA execution for vendor: {vendor_id}")
    
    try:
        # Ensure lead_id is extracted (already done above for diagnostics, but keep for safety)
        if not lead_id or lead_id == "unknown":
            lead_id = lead_data.get('id') or lead_data.get('leadId')
        
        if not lead_id:
            logger.error("❌ Lead ID not found in LEAD_DATA")
            await save_diagnostic_to_cosmos(
                "unknown", vendor_id, "lead_id", "failed",
                "Lead ID not found in lead_data"
            )
            return
        
        logger.info(f"📋 Processing lead: {lead_id}")
        
        # ===== DEDUPLICATION CHECK =====
        # Check if plans already exist for this lead+vendor combination
        # This prevents duplicate RPA runs when Event Grid retries or multiple triggers occur
        logger.info(f"🔍 Checking for existing plans for lead {lead_id} and vendor {vendor_id}")
        
        cosmos_conn = os.environ.get('COSMOS_CONNECTION_STRING')
        if cosmos_conn:
            try:
                from azure.cosmos import CosmosClient
                
                client = CosmosClient.from_connection_string(cosmos_conn)
                database = client.get_database_client('lead-service-db')
                container = database.get_container_client('plans')
                
                # Query for existing plans for this lead + vendor
                query = {
                    'query': 'SELECT VALUE COUNT(1) FROM c WHERE c.leadId = @leadId AND c.vendorId = @vendorId AND c.type = @type',
                    'parameters': [
                        {'name': '@leadId', 'value': lead_id},
                        {'name': '@vendorId', 'value': vendor_id},
                        {'name': '@type', 'value': 'plan'}
                    ]
                }
                
                results = list(container.query_items(query=query, enable_cross_partition_query=True))
                existing_count = results[0] if results else 0
                
                if existing_count > 0:
                    logger.warning(f"⚠️  DEDUPLICATION: Found {existing_count} existing plans for lead {lead_id} from vendor {vendor_id}")
                    logger.warning(f"⚠️  Skipping RPA execution to prevent duplicates")
                    
                    await save_diagnostic_to_cosmos(
                        lead_id, vendor_id, "deduplication", "skipped",
                        f"RPA execution skipped - {existing_count} plans already exist",
                        {"existing_plan_count": existing_count}
                    )
                    
                    logger.info("✅ Exiting gracefully (plans already exist)")
                    return
                else:
                    logger.info(f"✅ No existing plans found - proceeding with RPA execution")
                    
                    await save_diagnostic_to_cosmos(
                        lead_id, vendor_id, "deduplication", "proceed",
                        "No existing plans found - proceeding with RPA",
                        {"existing_plan_count": 0}
                    )
                
            except Exception as dedupe_error:
                logger.warning(f"⚠️  Deduplication check failed: {dedupe_error}")
                logger.info("Proceeding with RPA execution anyway")
        else:
            logger.warning("⚠️  COSMOS_CONNECTION_STRING not available - skipping deduplication check")
        # ===== END DEDUPLICATION CHECK =====
        
        # Parse credentials with improved error handling
        try:
            credentials = json.loads(credentials_str)
            if not credentials:
                raise ValueError("Empty credentials")
            
            # Validate vendor credentials exist
            vendor_creds = credentials.get(vendor_id)
            if not vendor_creds:
                raise ValueError(f"No credentials found for vendor: {vendor_id}")
            
            # Validate required fields
            if not isinstance(vendor_creds, dict):
                raise ValueError(f"Credentials for {vendor_id} must be a dict, got {type(vendor_creds)}")
            
            if 'username' not in vendor_creds or 'password' not in vendor_creds:
                raise ValueError(f"Credentials for {vendor_id} missing username or password")
            
            logger.info(f"✅ Loaded credentials for {vendor_id} from environment")
            credentials = vendor_creds  # Use vendor-specific credentials
            
            # DIAGNOSTIC STAGE 3: Credentials loaded
            await save_diagnostic_to_cosmos(
                lead_id, vendor_id, "credentials", "success",
                f"Credentials loaded successfully for {vendor_id}",
                {"has_username": bool(vendor_creds.get('username')), "has_password": bool(vendor_creds.get('password'))}
            )
            
        except Exception as cred_error:
            logger.error(f"Failed to parse credentials from environment: {cred_error}")
            # Fall back to credentials.json if available
            # Try multiple paths (container vs local)
            credential_paths = [
                '/app/config/credentials.json',  # Container path
                'config/credentials.json',  # Local relative path
                os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config', 'credentials.json')  # Absolute local
            ]
            credentials = {}
            for cred_path in credential_paths:
                try:
                    if os.path.exists(cred_path):
                        logger.info(f"Loading credentials from: {cred_path}")
                        with open(cred_path, 'r') as f:
                            all_credentials = json.load(f)
                            credentials = all_credentials.get(vendor_id, {})
                            logger.info(f"Loaded credentials for {vendor_id}: {list(credentials.keys())}")
                            break
                except Exception as e:
                    logger.warning(f"Failed to load from {cred_path}: {e}")
                    continue
        
        # Get bot and adapter classes from registry
        logger.info(f"Loading bot and adapter for vendor: {vendor_id}")
        
        # Strip "vendor-" prefix if present (Cosmos DB uses "vendor-takaful", registry uses "takaful")
        registry_vendor_id = vendor_id.replace("vendor-", "") if vendor_id.startswith("vendor-") else vendor_id
        logger.info(f"Registry vendor ID: {registry_vendor_id}")
        
        bot_class = vendor_registry.get_bot(registry_vendor_id)
        adapter_class = vendor_registry.get_adapter(registry_vendor_id)
        
        # CRITICAL: Check if classes were loaded
        if bot_class is None:
            error_msg = f"Bot class not found for vendor '{registry_vendor_id}'. Available vendors: {vendor_registry.list_vendors()}"
            logger.error(error_msg)
            await save_diagnostic_to_cosmos(
                lead_id, vendor_id, "bot_init", "error",
                error_msg,
                {"available_vendors": vendor_registry.list_vendors(), "requested_vendor": registry_vendor_id}
            )
            raise ValueError(error_msg)
        
        if adapter_class is None:
            error_msg = f"Adapter class not found for vendor '{registry_vendor_id}'. Available vendors: {vendor_registry.list_vendors()}"
            logger.error(error_msg)
            await save_diagnostic_to_cosmos(
                lead_id, vendor_id, "bot_init", "error",
                error_msg,
                {"available_vendors": vendor_registry.list_vendors(), "requested_vendor": registry_vendor_id}
            )
            raise ValueError(error_msg)
        
        # DIAGNOSTIC STAGE 4: Bot classes loaded
        await save_diagnostic_to_cosmos(
            lead_id, vendor_id, "bot_init", "success",
            f"Bot and adapter classes loaded: {bot_class.__name__}",
            {"bot_class": bot_class.__name__, "adapter_class": adapter_class.__name__}
        )
        
        # Initialize adapter
        adapter = adapter_class()
        
        # Prepare vendor payload using adapter
        logger.info("📝 Preparing vendor-specific payload")
        if not isinstance(lead_data, dict):
             raise ValueError(f"lead_data must be a dict, got {type(lead_data)}: {str(lead_data)[:100]}")

        vendor_payload = adapter.prepare_vendor_payload(lead_data)
        
        # Load vendor-specific configuration
        vendor_config = vendor_registry.get_config(registry_vendor_id)
        if not vendor_config:
            logger.warning(f"No vendor config found for {registry_vendor_id}, using defaults")
            vendor_config = {}
        
        # Bot configuration (merge vendor config with browser config)
        bot_config = {
            'headless': os.environ.get('PW_HEADLESS', 'true').lower() == 'true',
            'browser_type': 'chromium',
            'log_level': os.environ.get('LOG_LEVEL', 'INFO'),
            'enable_screenshots': False,
            'default_timeout': 60000,  # Increased from 30s to 60s for complex forms
            'navigation_timeout': 90000,  # Increased from 60s to 90s
            'slow_mo': 0,
            # Add vendor-specific config
            **vendor_config
        }
        
        logger.info(f"Bot config loaded with portal URL: {bot_config.get('portalUrl', 'N/A')}")
        
        # Initialize and run bot using context manager
        logger.info("Initializing bot and starting browser")
        
        # Browser launch (context manager handles errors)
        async with bot_class(credentials=credentials, config=bot_config) as bot:
            logger.info("Browser started successfully")
            
            # DIAGNOSTIC STAGE 5: Browser launched
            await save_diagnostic_to_cosmos(
                lead_id, vendor_id, "browser_launch", "success",
                "Playwright browser launched successfully"
            )
            
            # Portal navigation with timeout
            try:
                logger.info("Navigating to portal")
                await asyncio.wait_for(bot.navigate_to_portal(), timeout=45.0)
                
                # DIAGNOSTIC STAGE 6: Portal navigation
                await save_diagnostic_to_cosmos(
                    lead_id, vendor_id, "navigation", "success",
                    "Successfully navigated to portal"
                )
            except asyncio.TimeoutError:
                await save_diagnostic_to_cosmos(
                    lead_id, vendor_id, "navigation", "timeout",
                    "Portal navigation timeout (45s)"
                )
                raise TimeoutError("Portal navigation timed out after 45 seconds")
            
            # Login with timeout
            try:
                logger.info("Performing login")
                await asyncio.wait_for(bot.login(), timeout=90.0)
                
                # DIAGNOSTIC STAGE 7: Login successful
                await save_diagnostic_to_cosmos(
                    lead_id, vendor_id, "login", "success",
                    "Successfully logged in to portal"
                )
            except asyncio.TimeoutError:
                await save_diagnostic_to_cosmos(
                    lead_id, vendor_id, "login", "timeout",
                    "Login timeout (90s)"
                )
                raise TimeoutError("Login timed out after 90 seconds")
            
            # Wait for dashboard
            await asyncio.sleep(2)
            
            # Navigate to form (vendor-specific)
            if hasattr(bot, 'navigate_to_form_from_dashboard'):
                try:
                    logger.info("Navigating to form from dashboard")
                    await asyncio.wait_for(bot.navigate_to_form_from_dashboard(), timeout=30.0)
                    
                    await save_diagnostic_to_cosmos(
                        lead_id, vendor_id, "form_navigation", "success",
                        "Navigated to form from dashboard"
                    )
                except asyncio.TimeoutError:
                    await save_diagnostic_to_cosmos(
                        lead_id, vendor_id, "form_navigation", "timeout",
                        "Form navigation timeout (30s)"
                    )
                    raise TimeoutError("Form navigation timed out after 30 seconds")
            
            # Fill form (vendor-specific)
            if hasattr(bot, 'fill_insurance_form'):
                try:
                    logger.info("Filling insurance form")
                    
                    # Configure timeout based on vendor complexity
                    # Takaful has complex multi-step forms with 23+ wait operations
                    vendor_timeouts = {
                        'takaful': 180.0,  # 3 minutes - complex forms with many steps
                        'watania': 120.0,  # 2 minutes - medium complexity
                    }
                    
                    # Strip "vendor-" prefix if present for lookup
                    vendor_key = registry_vendor_id.replace('vendor-', '')
                    form_timeout = vendor_timeouts.get(vendor_key, 60.0)  # Default 60s for simple forms
                    
                    logger.info(f"Using form fill timeout: {form_timeout}s for vendor {vendor_key}")
                    await asyncio.wait_for(bot.fill_insurance_form(vendor_payload), timeout=form_timeout)
                    
                    await save_diagnostic_to_cosmos(
                        lead_id, vendor_id, "form_fill", "success",
                        "Form filled successfully"
                    )
                except asyncio.TimeoutError:
                    await save_diagnostic_to_cosmos(
                        lead_id, vendor_id, "form_fill", "timeout",
                        f"Form fill timeout ({form_timeout}s)"
                    )
                    raise TimeoutError(f"Form filling timed out after {form_timeout} seconds. Vendor '{vendor_key}' may need longer timeout.")
            
            # Wait for plans to load
            await asyncio.sleep(3)
            
            # Extract plans with timeout
            async def extract_plans():
                logger.info("Extracting plans from portal")
                raw_plans = []
                
                # Check if bot has built-in scraper support (like Watania, Takaful)
                if registry_vendor_id == 'watania':
                    # Import Watania scraper
                    from vendors.watania.scraper import WataniaScraper
                    
                    # Pass vendor_payload (which includes leadId) to scraper
                    scraper = WataniaScraper(bot.page, bot_config, vendor_payload)
                    raw_plans = await scraper.extract_all_plans(bot)
                    logger.info(f"Extracted {len(raw_plans)} plans from Watania portal")
                elif registry_vendor_id == 'takaful':
                    # Import Takaful scraper
                    from vendors.takaful.scraper import TakafulScraper
                    
                    # Pass vendor_payload (which includes leadId) to scraper
                    scraper = TakafulScraper(bot.page, bot_config, vendor_payload)
                    raw_plans = await scraper.extract_all_plans(bot)
                    logger.info(f"Extracted {len(raw_plans)} plans from Takaful portal")
                elif registry_vendor_id == 'alsagr':
                    # Import Alsagr scraper
                    from vendors.alsagr.scraper import AlsagrScraper
                    
                    # Pass vendor_payload (which includes leadId) to scraper
                    scraper = AlsagrScraper(bot.page, bot_config, vendor_payload)
                    raw_plans = await scraper.extract_all_plans(bot)
                    logger.info(f"Extracted {len(raw_plans)} plans from Alsagr portal")
                elif registry_vendor_id == 'sukoon':
                    # Import Sukoon scraper
                    from vendors.sukoon.scraper import SukoonScraper
                    
                    # Pass vendor_payload (which includes leadId) to scraper
                    scraper = SukoonScraper(bot.page, bot_config, vendor_payload)
                    raw_plans = await scraper.extract_all_plans(bot)
                    logger.info(f"Extracted {len(raw_plans)} plans from Sukoon portal")
                else:
                    # Generic extraction (placeholder for other vendors)
                    logger.warning(f"No specific scraper for {registry_vendor_id}, using generic extraction")
                    # TODO: Implement generic scraper or vendor-specific scrapers
                    raw_plans = []
                
                return raw_plans
            
            try:
                # Configure extraction timeout based on vendor complexity
                # Alsagr needs to extract modals + download + parse PDFs for each plan (~15-20s per plan)
                extraction_timeouts = {
                    'alsagr': 900.0,   # 15 minutes - increased for safety (was 600s/10min)
                    'watania': 300.0,  # 5 minutes - complex extraction
                    'takaful': 180.0,  # 3 minutes - standard extraction
                    'sukoon': 180.0,   # 3 minutes - standard extraction
                }
                
                extraction_timeout = extraction_timeouts.get(registry_vendor_id, 120.0)
                logger.info(f"Using plan extraction timeout: {extraction_timeout}s for vendor {registry_vendor_id}")
                
                raw_plans = await asyncio.wait_for(extract_plans(), timeout=extraction_timeout)
                
                # The scraper already returns StandardPlan format
                logger.info(f"✅ Successfully processed {len(raw_plans)} plans")
                
                # DIAGNOSTIC STAGE 8: Plan extraction completed
                await save_diagnostic_to_cosmos(
                    lead_id, vendor_id, "plan_extraction", "success",
                    f"Extracted {len(raw_plans)} plans from portal",
                    {"plan_count": len(raw_plans)}
                )
            except asyncio.TimeoutError:
                await save_diagnostic_to_cosmos(
                    lead_id, vendor_id, "plan_extraction", "timeout",
                    f"Plan extraction timeout ({extraction_timeout}s)"
                )
                raise TimeoutError(f"Plan extraction timed out after {extraction_timeout} seconds")
            except Exception as e:
                # Catch any other exceptions during plan extraction
                import traceback
                error_tb = traceback.format_exc()
                logger.error(f"❌ Plan extraction failed: {e}")
                logger.error(f"Traceback: {error_tb}")
                
                await save_diagnostic_to_cosmos(
                    lead_id, vendor_id, "plan_extraction", "error",
                    f"Plan extraction failed: {str(e)}",
                    {"error": str(e), "traceback": error_tb[:1000]}
                )
                raise  # Re-raise to trigger error handling
            
            # Save plans directly to Cosmos DB
            if raw_plans:
                saved_count = await save_plans_to_cosmos(
                    lead_id=lead_id,
                    vendor_id=vendor_id,
                    plans=raw_plans
                )
                logger.info(f"🎉 RPA execution completed: {saved_count} plans saved to Cosmos DB")
                
                # Wait for Cosmos DB eventual consistency before verifying
                logger.info("⏳ Waiting 3 seconds for Cosmos DB to commit changes...")
                await asyncio.sleep(3)
                
                # Verify plans are queryable before publishing event
                # This prevents race condition where event is published before plans are readable
                verified_count = 0
                try:
                    cosmos_conn = os.environ.get('COSMOS_CONNECTION_STRING')
                    if cosmos_conn:
                        client = CosmosClient.from_connection_string(cosmos_conn)
                        database = client.get_database_client('lead-service-db')
                        container = database.get_container_client('plans')
                        
                        query = {
                            'query': 'SELECT VALUE COUNT(1) FROM c WHERE c.leadId = @leadId AND c.vendorId = @vendorId AND c.type = @type',
                            'parameters': [
                                {'name': '@leadId', 'value': lead_id},
                                {'name': '@vendorId', 'value': vendor_id},
                                {'name': '@type', 'value': 'plan'}
                            ]
                        }
                        
                        results = list(container.query_items(query=query, enable_cross_partition_query=True))
                        verified_count = results[0] if results else 0
                        
                        logger.info(f"✅ Verified {verified_count} plans are queryable in database")
                        
                        if verified_count != saved_count:
                            logger.warning(f"⚠️  Saved {saved_count} but only {verified_count} are queryable. Waiting 2 more seconds...")
                            await asyncio.sleep(2)
                            # Re-verify
                            results = list(container.query_items(query=query, enable_cross_partition_query=True))
                            verified_count = results[0] if results else 0
                            logger.info(f"✅ After retry: {verified_count} plans verified")
                    else:
                        logger.warning("⚠️  COSMOS_CONNECTION_STRING not available for verification")
                        verified_count = saved_count
                except Exception as verify_error:
                    logger.warning(f"⚠️  Could not verify plans in DB: {verify_error}")
                    verified_count = saved_count  # Fallback to saved count
                
                # Publish plans.fetch_completed event (only after verification)
                try:
                    fetch_request_id = lead_data.get('fetchRequestId') if isinstance(lead_data, dict) else None
                    logger.info(f"[EVENT_PUBLISH] Starting event publication", extra={
                        'custom_dimensions': {
                            'lead_id': lead_id,
                            'vendor_id': vendor_id,
                            'plan_count': verified_count,
                            'event_type': 'plans.fetch_completed'
                        }
                    })
                    
                    result = publish_plans_fetch_completed_event(
                        lead_id=lead_id,
                        vendor_id=vendor_id,
                        plan_count=verified_count,
                        fetch_request_id=fetch_request_id
                    )
                    
                    logger.info(f"[EVENT_PUBLISH] Successfully published event", extra={
                        'custom_dimensions': {
                            'lead_id': lead_id,
                            'vendor_id': vendor_id,
                            'plan_count': verified_count,
                            'result': str(result)
                        }
                    })
                    logger.info(f"✅ Published plans.fetch_completed event")
                except Exception as event_error:
                    logger.error(f"[EVENT_PUBLISH] Failed to publish event", extra={
                        'custom_dimensions': {
                            'lead_id': lead_id,
                            'vendor_id': vendor_id,
                            'error_type': type(event_error).__name__,
                            'error_message': str(event_error),
                            'traceback': traceback.format_exc()[:1000]
                        }
                    })
                    logger.error(f"❌ Failed to publish completion event: {event_error}")
            else:
                logger.warning(f"⚠️ No plans extracted from {vendor_id} portal")
                
                # Publish with 0 plans
                try:
                    fetch_request_id = lead_data.get('fetchRequestId') if isinstance(lead_data, dict) else None
                    logger.info(f"[EVENT_PUBLISH] Starting event publication (0 plans)", extra={
                        'custom_dimensions': {
                            'lead_id': lead_id,
                            'vendor_id': vendor_id,
                            'plan_count': 0,
                            'event_type': 'plans.fetch_completed'
                        }
                    })
                    
                    result = publish_plans_fetch_completed_event(
                        lead_id=lead_id,
                        vendor_id=vendor_id,
                        plan_count=0,
                        fetch_request_id=fetch_request_id
                    )
                    
                    logger.info(f"[EVENT_PUBLISH] Successfully published event (0 plans)", extra={
                        'custom_dimensions': {
                            'lead_id': lead_id,
                            'vendor_id': vendor_id,
                            'plan_count': 0,
                            'result': str(result)
                        }
                    })
                    logger.info(f"✅ Published plans.fetch_completed event (0 plans)")
                except Exception as event_error:
                    logger.error(f"[EVENT_PUBLISH] Failed to publish event (0 plans)", extra={
                        'custom_dimensions': {
                            'lead_id': lead_id,
                            'vendor_id': vendor_id,
                            'error_type': type(event_error).__name__,
                            'error_message': str(event_error),
                            'traceback': traceback.format_exc()[:1000]
                        }
                    })
                    logger.error(f"❌ Failed to publish completion event: {event_error}")
            
            # Print success result
            result = {
                "lead_id": lead_id,
                "vendor_id": vendor_id,
                "success": True,
                "plan_count": len(raw_plans),
                "saved_count": len(raw_plans),
                "error": None
            }
            print(json.dumps(result))
    
    except Exception as e:
        logger.error(f"❌ RPA execution failed: {e}", exc_info=True)
        error_trace = traceback.format_exc()
        
        # DIAGNOSTIC: Save error information
        try:
            await save_diagnostic_to_cosmos(
                lead_id if 'lead_id' in locals() and lead_id != "unknown" else "error",
                vendor_id if 'vendor_id' in locals() and vendor_id != "unknown" else "error",
                "error", "failed",
                f"RPA execution failed: {str(e)}",
                {"error_type": type(e).__name__, "traceback": error_trace[:500]}
            )
        except Exception as diag_error:
            logger.error(f"Failed to save error diagnostic: {diag_error}")
        
        # Publish failure event to Event Grid
        try:
            success = publish_plans_fetch_failed_event(
                lead_id=lead_id if 'lead_id' in locals() else 'unknown',
                vendor_id=vendor_id,
                error=str(e),
                error_type=type(e).__name__
            )
            if success:
                logger.info(f"✅ Published plans.fetch_failed event for lead {lead_id}")
            else:
                logger.error("❌ Failed to publish plans.fetch_failed event")
        except Exception as event_error:
            logger.error(f"❌ Error publishing failure event: {event_error}")
        
        # Print error to stdout (existing behavior)
        error_result = {
            "lead_id": lead_id if 'lead_id' in locals() else 'unknown',
            "vendor_id": vendor_id,
            "success": False,
            "plan_count": 0,
            "saved_count": 0,
            "error": str(e)
        }
        print(json.dumps(error_result))

        # Try to save error to Cosmos DB for debugging visibility
        try:
            if 'cosmos_client' not in locals():
                cosmos_connection_string = os.environ.get('COSMOS_CONNECTION_STRING')
                if cosmos_connection_string:
                    cosmos_client = CosmosClient.from_connection_string(cosmos_connection_string)
            
            if 'cosmos_client' in locals():
                database = cosmos_client.get_database_client('lead-service-db')
                # Use vendorExecutions container instead of plans
                container = database.get_container_client('vendorExecutions')
                
                error_doc = {
                    "id": f"error_{lead_id}_{vendor_id}_{int(datetime.utcnow().timestamp())}",
                    "leadId": lead_id,
                    "vendorId": vendor_id,
                    "executionType": "error",
                    "status": "failed",
                    "message": str(e),
                    "error": str(e),
                    "traceback": error_trace,
                    "timestamp": datetime.utcnow().isoformat()
                }
                container.create_item(error_doc)
                logger.info("Saved error detail to Cosmos DB")
        except Exception as db_e:
            logger.error(f"Failed to save error to DB: {db_e}")

if __name__ == "__main__":
    logger.info("Container Executor starting...")
    asyncio.run(execute_rpa_task())
    logger.info("Container Executor finished")
