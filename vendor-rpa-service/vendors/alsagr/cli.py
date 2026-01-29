#!/usr/bin/env python3
"""
CLI wrapper for Alsagr bot - called from Node.js Express server
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

from vendors.alsagr.bot import AlsagrBot
from vendors.alsagr.adapter import AlsagrAdapter
from vendors.alsagr.scraper import AlsagrScraper
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
    parser = argparse.ArgumentParser(description='Run Alsagr bot')
    parser.add_argument('--lead-data', type=str, required=True, help='Lead data as JSON string')
    args = parser.parse_args()
    
    try:
        # Parse lead data
        lead_data_raw = json.loads(args.lead_data)
        
        # Handle nested structure: {success: true, data: {lead: {...}}}
        # or flat structure: {id: "...", formData: {...}}
        if isinstance(lead_data_raw, dict):
            if 'data' in lead_data_raw and 'lead' in lead_data_raw['data']:
                # Nested structure: extract the lead
                lead_data = lead_data_raw['data']['lead']
            elif 'id' in lead_data_raw:
                # Flat structure: use as-is
                lead_data = lead_data_raw
            else:
                # Try to find lead in any nested structure
                lead_data = lead_data_raw
        else:
            lead_data = lead_data_raw
        
        lead_id = lead_data.get('id')
        
        # DEBUG: Log exact lead data structure received from production
        print(f"\n{'='*60}", file=sys.stderr)
        print(f"🔍 PRODUCTION LEAD DATA DEBUG", file=sys.stderr)
        print(f"{'='*60}", file=sys.stderr)
        print(f"Lead ID: {lead_id}", file=sys.stderr)
        print(f"\n📋 Full Lead Data Structure:", file=sys.stderr)
        print(json.dumps(lead_data, indent=2), file=sys.stderr)
        
        # ADD: Comprehensive dependents check
        print(f"\n🔍 DEPENDENTS CHECK:", file=sys.stderr)
        lob_data = lead_data.get('lobData', {})
        form_data = lead_data.get('formData', {})
        print(f"  - Has lobData: {bool(lob_data)}", file=sys.stderr)
        print(f"  - Has formData: {bool(form_data)}", file=sys.stderr)
        print(f"  - Top-level dependents: {lead_data.get('dependents', [])}", file=sys.stderr)
        print(f"  - Marital Status: {lead_data.get('maritalStatus', 'N/A')}", file=sys.stderr)
        
        # Check all possible locations for dependents
        all_section_keys = [k for k in lead_data.keys() if k.startswith('section-')]
        if form_data:
            form_section_keys = [k for k in form_data.keys() if k.startswith('section-')]
            all_section_keys.extend(form_section_keys)
        
        print(f"  - All section-* keys found: {list(set(all_section_keys))}", file=sys.stderr)
        
        if form_data:
            section_keys = [k for k in form_data.keys() if k.startswith('section-')]
            print(f"  - formData section-* keys: {section_keys}", file=sys.stderr)
            for section_key in section_keys:
                section_data = form_data.get(section_key, [])
                print(f"    - {section_key}: {len(section_data)} items", file=sys.stderr)
                if section_data:
                    print(f"      First item: {json.dumps(section_data[0], indent=6)}", file=sys.stderr)
        
        # Check top-level section keys
        for key in lead_data.keys():
            if key.startswith('section-'):
                section_data = lead_data.get(key, [])
                print(f"  - Top-level {key}: {len(section_data)} items", file=sys.stderr)
                if section_data:
                    print(f"    First item: {json.dumps(section_data[0], indent=6)}", file=sys.stderr)
        
        if lob_data:
            print(f"  - lobData.dependents: {lob_data.get('dependents', [])}", file=sys.stderr)
        
        print(f"{'='*60}\n", file=sys.stderr)
        
        if not lead_id:
            raise ValueError("Lead ID is required")
        
        vendor_id = 'vendor-alsagr'
        registry_vendor_id = 'alsagr'
        
        # Load credentials
        cred_path = Path(__file__).parent.parent.parent / 'config' / 'credentials.json'
        with open(cred_path) as f:
            all_creds = json.load(f)
        
        credentials = all_creds.get(vendor_id)
        if not credentials:
            raise ValueError(f"Alsagr credentials not found for key: {vendor_id}")
        
        # Initialize adapter and prepare vendor payload
        adapter = AlsagrAdapter()
        vendor_payload = adapter.prepare_vendor_payload(lead_data)
        
        # Load vendor config
        vendor_config = vendor_registry.get_config(registry_vendor_id) or {}
        
        # Bot configuration
        # Use headless=True for production (faster, PDF downloads work better)
        bot_config = {
            'headless': False,  # DEBUG mode - visible browser
            'browser_type': 'chromium',
            'enable_screenshots': False,
            'default_timeout': 60000,
            'navigation_timeout': 90000,
            **vendor_config
        }
        
        print(f"Starting Alsagr bot for lead {lead_id}", file=sys.stderr)
        
        # Run bot using exact executor flow
        async with AlsagrBot(credentials=credentials, config=bot_config) as bot:
            print("Browser started", file=sys.stderr)
            
            # Step 1: Navigate to portal
            await asyncio.wait_for(bot.navigate_to_portal(), timeout=45.0)
            print("Portal navigation complete", file=sys.stderr)
            
            # Step 2: Login
            await asyncio.wait_for(bot.login(), timeout=90.0)
            print("Login successful", file=sys.stderr)
            await asyncio.sleep(2)
            
            # Step 3: Navigate to form (if method exists)
            if hasattr(bot, 'navigate_to_form_from_dashboard'):
                await asyncio.wait_for(bot.navigate_to_form_from_dashboard(), timeout=30.0)
                print("Form navigation complete", file=sys.stderr)
            
            # Step 4: Fill form with vendor payload
            if hasattr(bot, 'fill_insurance_form'):
                await asyncio.wait_for(bot.fill_insurance_form(vendor_payload), timeout=120.0)
                print("Form filled successfully", file=sys.stderr)
            
            # Step 5: Wait for plans to load
            await asyncio.sleep(3)
            
            # Step 6: Extract plans using scraper
            print("Extracting plans...", file=sys.stderr)
            # Add leadId to vendor_payload so parser can access it
            vendor_payload_with_lead = {**vendor_payload, 'leadId': lead_id}
            scraper = AlsagrScraper(bot.page, bot_config, vendor_payload_with_lead)
            raw_plans = await asyncio.wait_for(scraper.extract_all_plans(bot), timeout=900.0)
            print(f"Extracted {len(raw_plans)} raw plans", file=sys.stderr)
            
            # Step 6.5: Enrich plans with PDF data
            # CRITICAL: All plans MUST be enriched with PDF data to get:
            # - Inpatient limit
            # - Alternative Medicine
            # - Claims Settlement Basis
            # - Full inpatient/outpatient benefits
            print("Enriching plans with PDF data...", file=sys.stderr)
            from vendors.alsagr.pdf_parser import parse_plan_pdf
            enriched_plans = []
            pdf_paths_to_cleanup = []  # Track PDFs in case parsing fails
            enriched_count = 0
            missing_pdf_count = 0
            
            for plan in raw_plans:
                if plan.get('pdf_path'):
                    pdf_paths_to_cleanup.append(plan['pdf_path'])
                    try:
                        # Parse PDF and enrich plan data (PDF will be deleted inside parse_plan_pdf)
                        enriched_plan = await parse_plan_pdf(plan['pdf_path'], plan)
                        
                        # Verify critical fields were extracted
                        has_alt_med = bool(enriched_plan.get('lobSpecificData', {}).get('alternativeMedicine'))
                        has_claims = bool(enriched_plan.get('lobSpecificData', {}).get('claimsSettlementBasis'))
                        has_inpatient = bool(enriched_plan.get('inpatientLimit', 0) > 0 or 
                                          any(b.get('categoryId') == 'inpatient' for b in enriched_plan.get('benefits', [])))
                        
                        enriched_plans.append(enriched_plan)
                        enriched_count += 1
                        
                        # Log what was extracted
                        extracted_fields = []
                        if has_alt_med:
                            extracted_fields.append("Alternative Medicine")
                        if has_claims:
                            extracted_fields.append("Claims Settlement Basis")
                        if has_inpatient:
                            extracted_fields.append("Inpatient")
                        
                        if extracted_fields:
                            print(f"  ✓ Enriched plan {enriched_plan.get('planCode', 'N/A')}: {', '.join(extracted_fields)}", file=sys.stderr)
                        else:
                            print(f"  ✓ Enriched plan {enriched_plan.get('planCode', 'N/A')} (basic data)", file=sys.stderr)
                    except Exception as e:
                        print(f"  ⚠️ PDF parsing failed for plan {plan.get('planCode', 'N/A')}, using base plan: {e}", file=sys.stderr)
                        enriched_plans.append(plan)
                        # Cleanup failed PDF
                        try:
                            if os.path.exists(plan['pdf_path']):
                                os.remove(plan['pdf_path'])
                        except:
                            pass
                else:
                    missing_pdf_count += 1
                    print(f"  ⚠️ Plan {plan.get('planCode', 'N/A')} missing PDF - will not have Alternative Medicine, Claims Settlement Basis, or Inpatient limit", file=sys.stderr)
                    enriched_plans.append(plan)
            
            print(f"PDF enrichment complete: {enriched_count} plans enriched, {missing_pdf_count} plans without PDF", file=sys.stderr)
            
            # Cleanup any remaining PDFs in download directory
            try:
                download_dir = os.environ.get('DOWNLOAD_DIR', '/tmp/alsagr_downloads')
                if os.path.exists(download_dir):
                    remaining_files = os.listdir(download_dir)
                    if remaining_files:
                        print(f"  🗑️  Cleaning up {len(remaining_files)} remaining files in {download_dir}", file=sys.stderr)
                        for filename in remaining_files:
                            try:
                                os.remove(os.path.join(download_dir, filename))
                            except:
                                pass
            except Exception as cleanup_error:
                print(f"  ⚠️ Directory cleanup warning: {cleanup_error}", file=sys.stderr)
            
            # Step 7: Normalize plans using adapter
            standard_plans = adapter.normalize_response(enriched_plans, lead_id)
            print(f"Normalized to {len(standard_plans)} standard plans", file=sys.stderr)
            
            # Step 8: Save to Cosmos DB
            if standard_plans:
                await save_plans_to_cosmos(lead_id, vendor_id, standard_plans)
            
            # Step 9: Return plans as JSON to stdout (ensure clean output)
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
