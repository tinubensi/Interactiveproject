"""
Azure Function App for RPA Trigger
Receives HTTP requests when leads are created and enqueues RPA jobs via Storage Queue
"""
import azure.functions as func
import logging
import json
import asyncio
import sys
import os

# Initialize Function App
app = func.FunctionApp()

logging.basicConfig(level=logging.INFO)
logging.info("RPA Trigger Function App initialized (Queue Mode)")


@app.route(route="rpa/trigger", methods=["POST"], auth_level=func.AuthLevel.FUNCTION)
def rpa_trigger_http(req: func.HttpRequest) -> func.HttpResponse:
    """
    HTTP trigger for RPA execution (synchronous wrapper for async operations)
    Called by Lead Service after creating a lead
    
    Expected POST body:
    {
        "leadId": "...",
        "lineOfBusiness": "medical",
        "lobData": { ... },
        "firstName": "...",
        "lastName": "...",
        "email": "...",
        ...
    }
    
    Returns:
    {
        "success": true,
        "leadId": "...",
        "vendorsTriggered": ["watania", "nextcare"],
        "message": "RPA jobs started successfully"
    }
    """
    logging.info('RPA HTTP Trigger invoked')
    
    try:
        # Parse request body
        req_body = req.get_json()
        
        if not req_body:
            logging.warning("Empty request body received")
            return func.HttpResponse(
                json.dumps({"error": "Request body is required"}),
                status_code=400,
                mimetype="application/json"
            )
        
        logging.info(f"Request body received: {json.dumps(req_body)}")
        
        # Import handler (do this inside function to catch import errors)
        try:
            from functions.rpa_trigger import handle_lead_created_http
            logging.info("Successfully imported rpa_trigger handler")
        except Exception as import_err:
            logging.error(f"Import error: {str(import_err)}", exc_info=True)
            return func.HttpResponse(
                json.dumps({"error": f"Import failed: {str(import_err)}"}),
                status_code=500,
                mimetype="application/json"
            )
        
        # Run async function synchronously using asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(handle_lead_created_http(req_body))
            logging.info(f"Handler result: {json.dumps(result)}")
        finally:
            loop.close()
        
        return func.HttpResponse(
            json.dumps(result),
            status_code=200 if result.get("success") else 500,
            mimetype="application/json"
        )
        
    except ValueError as e:
        logging.error(f"Invalid request: {str(e)}", exc_info=True)
        return func.HttpResponse(
            json.dumps({"error": f"Invalid request: {str(e)}"}),
            status_code=400,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error processing request: {str(e)}", exc_info=True)
        return func.HttpResponse(
            json.dumps({"error": f"Internal error: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )


@app.route(route="health", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def health_check(req: func.HttpRequest) -> func.HttpResponse:
    """Simple health check endpoint to verify function is running"""
    logging.info('Health check called')
    return func.HttpResponse(
        json.dumps({"status": "healthy", "service": "rpa-trigger", "version": "1.0"}),
        status_code=200,
        mimetype="application/json"
    )
