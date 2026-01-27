#!/usr/bin/env python3
"""
CLI wrapper for GIG Gulf bot - called from Node.js Express server
Follows the exact executor.py flow with adapter pattern
"""
import asyncio
import json
import sys
import os
import argparse
from pathlib import Path
from datetime import datetime

# Add vendor-rpa-service directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from vendors.gig_gulf.bot import Gig_gulfBot
from vendors.gig_gulf.adapter import Gig_gulfAdapter
from vendors.gig_gulf.scraper import Gig_gulfScraper
from vendors import vendor_registry


async def save_plans_to_cosmos(lead_id: str, vendor_id: str, plans: list):
    """Save plans directly to Cosmos DB (optional - will not fail if azure module is missing)"""
    try:
        from azure.cosmos import CosmosClient
    except ImportError:
        print("Warning: azure-cosmos module not installed, skipping Cosmos save", file=sys.stderr)
        return
    
    cosmos_conn = os.environ.get('COSMOS_CONNECTION_STRING')
    if not cosmos_conn:
        print("Warning: COSMOS_CONNECTION_STRING not set, skipping Cosmos save", file=sys.stderr)
        return
    
    try:
        client = CosmosClient.from_connection_string(cosmos_conn)
        database = client.get_database_client('lead-service-db')
        container = database.get_container_client('plans')
        
        for plan in plans:
            plan_code = plan.get('planCode', 'unknown')
            plan_doc = {
                'id': f"{lead_id}_{vendor_id}_{plan_code}",
                'type': 'plan',
                'leadId': lead_id,
                'vendorId': vendor_id,
                'fetchedAt': datetime.utcnow().isoformat(),
                **plan
            }
            container.upsert_item(plan_doc)
        
        print(f"Saved {len(plans)} plans to Cosmos DB", file=sys.stderr)
    except Exception as e:
        print(f"Error saving to Cosmos DB: {str(e)}", file=sys.stderr)


async def main():
    parser = argparse.ArgumentParser(description='Run GIG Gulf bot')
    parser.add_argument('--lead-data', type=str, required=True, help='Lead data as JSON string')
    args = parser.parse_args()
    
    try:
        # Parse lead data
        lead_data = json.loads(args.lead_data)
        lead_id = lead_data.get('id')
        
        if not lead_id:
            raise ValueError("Lead ID is required")
        
        vendor_id = 'vendor-gig-gulf'
        registry_vendor_id = 'gig-gulf'
        
        # Load credentials
        cred_path = Path(__file__).parent.parent.parent / 'config' / 'credentials.json'
        with open(cred_path) as f:
            all_creds = json.load(f)
        
        credentials = all_creds.get(vendor_id)
        if not credentials:
            raise ValueError(f"GIG Gulf credentials not found for key: {vendor_id}")
        
        # Initialize adapter and prepare vendor payload
        adapter = Gig_gulfAdapter()
        vendor_payload = adapter.prepare_vendor_payload(lead_data)
        
        # Load vendor config
        vendor_config = vendor_registry.get_config(registry_vendor_id) or {}
        
        # Bot configuration
        bot_config = {
            'headless': True,
            'browser_type': 'chromium',
            'enable_screenshots': False,
            'default_timeout': 60000,
            'navigation_timeout': 90000,
            **vendor_config
        }
        
        print(f"Starting GIG Gulf bot for lead {lead_id}", file=sys.stderr)
        
        # Run bot using exact executor flow
        async with Gig_gulfBot(credentials=credentials, config=bot_config) as bot:
            print("Browser started", file=sys.stderr)
            
            # Step 1: Navigate to portal
            await asyncio.wait_for(bot.navigate_to_portal(), timeout=45.0)
            print("Portal navigation complete", file=sys.stderr)
            
            # Step 2: Login
            await asyncio.wait_for(bot.login(), timeout=90.0)
            print("Login successful", file=sys.stderr)
            await asyncio.sleep(2)
            
            # Step 3: Fill form with vendor payload
            await asyncio.wait_for(bot.fill_insurance_form(vendor_payload), timeout=120.0)
            print("Form filled successfully", file=sys.stderr)
            
            # Step 4: Wait for plans to load
            await asyncio.sleep(3)
            
            # Step 5: Extract plans using scraper
            print("Extracting plans...", file=sys.stderr)
            scraper = Gig_gulfScraper(bot.page, bot_config, vendor_payload)
            raw_plans = await asyncio.wait_for(scraper.extract_all_plans(bot), timeout=900.0)
            print(f"Extracted {len(raw_plans)} raw plans", file=sys.stderr)
            
            # Step 6: Normalize plans using adapter
            standard_plans = adapter.normalize_response(raw_plans, lead_id)
            print(f"Normalized to {len(standard_plans)} standard plans", file=sys.stderr)
            
            # Step 7: Save to Cosmos DB (optional - won't block JSON output if it fails)
            if standard_plans:
                try:
                    await save_plans_to_cosmos(lead_id, vendor_id, standard_plans)
                except Exception as e:
                    print(f"Warning: Cosmos save failed but continuing: {str(e)}", file=sys.stderr)
            
            # Step 8: Return plans as JSON to stdout (ensure clean output)
            sys.stdout.flush()  # Flush any buffered output
            print(json.dumps(standard_plans), flush=True)
            sys.stdout.flush()  # Ensure JSON is written
            sys.exit(0)
    
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())
