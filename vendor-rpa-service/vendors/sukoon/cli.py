#!/usr/bin/env python3
"""
CLI wrapper for Sukoon bot - called from Node.js Express server
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

from vendors.sukoon.bot import SukoonBot
from vendors.sukoon.adapter import SukoonAdapter
from vendors.sukoon.scraper import SukoonScraper
from vendors import vendor_registry


async def save_plans_to_cosmos(lead_id: str, vendor_id: str, plans: list):
    """Save plans directly to Cosmos DB"""
    from azure.cosmos import CosmosClient
    
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
    parser = argparse.ArgumentParser(description='Run Sukoon bot')
    parser.add_argument('--lead-data', type=str, required=True, help='Lead data as JSON string')
    args = parser.parse_args()
    
    try:
        # Parse lead data
        lead_data = json.loads(args.lead_data)
        lead_id = lead_data.get('id')
        
        if not lead_id:
            raise ValueError("Lead ID is required")
        
        vendor_id = 'vendor-sukoon'
        registry_vendor_id = 'sukoon'
        
        # Load credentials
        cred_path = Path(__file__).parent.parent.parent / 'config' / 'credentials.json'
        with open(cred_path) as f:
            all_creds = json.load(f)
        
        credentials = all_creds.get(vendor_id)
        if not credentials:
            raise ValueError(f"Sukoon credentials not found for key: {vendor_id}")
        
        # Initialize adapter and prepare vendor payload
        adapter = SukoonAdapter()
        vendor_payload = adapter.prepare_vendor_payload(lead_data)
        
        # Load vendor config
        vendor_config = vendor_registry.get_config(registry_vendor_id) or {}
        
        # Bot configuration
        bot_config = {
            'headless': True,  # Production mode - headless for VM without display server
            'browser_type': 'chromium',
            'enable_screenshots': False,
            'default_timeout': 60000,
            'navigation_timeout': 90000,
            **vendor_config
        }
        
        print(f"Starting Sukoon bot for lead {lead_id}", file=sys.stderr)
        
        # Run bot using exact executor flow
        async with SukoonBot(credentials=credentials, config=bot_config) as bot:
            print("Browser started", file=sys.stderr)
            
            # Step 1: Navigate to portal
            await asyncio.wait_for(bot.navigate_to_portal(), timeout=45.0)
            print("Portal navigation complete", file=sys.stderr)
            
            # Step 2: Login
            await asyncio.wait_for(bot.login(), timeout=90.0)
            print("Login successful", file=sys.stderr)
            await asyncio.sleep(2)
            
            # Step 3: Fill form with vendor payload
            await asyncio.wait_for(bot.fill_insurance_form(vendor_payload), timeout=180.0)
            print("Form filled successfully", file=sys.stderr)
            
            # Step 4: Wait for plans to load
            await asyncio.sleep(3)
            
            # Step 5: Extract plans using scraper
            print("Extracting plans...", file=sys.stderr)
            scraper = SukoonScraper(bot.page, bot_config, vendor_payload)
            raw_plans = await asyncio.wait_for(scraper.extract_all_plans(bot), timeout=180.0)
            print(f"Extracted {len(raw_plans)} raw plans", file=sys.stderr)
            
            # Step 6: Normalize plans using adapter
            standard_plans = adapter.normalize_response(raw_plans, lead_id)
            print(f"Normalized to {len(standard_plans)} standard plans", file=sys.stderr)
            
            # Step 7: Save to Cosmos DB
            if standard_plans:
                await save_plans_to_cosmos(lead_id, vendor_id, standard_plans)
            
            # Step 8: Return plans as JSON to stdout
            print(json.dumps(standard_plans))
            sys.exit(0)
    
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())
