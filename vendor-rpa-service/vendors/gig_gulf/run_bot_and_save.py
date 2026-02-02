#!/usr/bin/env python3
"""
Run GIG bot, fetch plans, normalize to standard structure, and save to JSON
"""
import asyncio
import json
import sys
from pathlib import Path
from datetime import datetime

# Add vendor-rpa-service directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from vendors.gig_gulf.bot import Gig_gulfBot
from vendors.gig_gulf.adapter import Gig_gulfAdapter
from vendors.gig_gulf.scraper import Gig_gulfScraper
from vendors import vendor_registry


async def run_bot_and_save():
    """Run bot, fetch plans, normalize, and save to JSON"""
    
    # Test lead data
    test_lead = {
        "id": f"test-gig-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
        "firstName": "Kane",
        "lastName": "Williamson",
        "email": "kanetest@gmail.com",
        "phone": {
            "countryCode": "+971",
            "number": "501234567"
        },
        "dob": "1996-06-13",
        "gender": "Male",
        "nationality": "Belgian",
        "emirate": "Dubai",
        "occupation": "Accountant",
        "lobData": {
            "dateOfBirth": "1996-06-13",
            "effectiveDate": "31/01/2026",
            "gender": "Male",
            "maritalStatus": "Single",
            "nationality": "Belgian",
            "state": "Dubai",
            "visaLocation": "Dubai",
            "passportCountry": "Belgium",
            "workLocation": "AL KARAMA",
            "occupation": "Accountant",
            "salaryRange": ">4000 and <=12000 AED/month",
            "visaType": "Resident visa"
        }
    }
    
    lead_id = test_lead['id']
    vendor_id = 'vendor-gig-gulf'
    registry_vendor_id = 'gig-gulf'
    
    # Load credentials
    cred_path = Path(__file__).parent.parent.parent / 'config' / 'credentials.json'
    if not cred_path.exists():
        print(f"❌ Error: Credentials file not found at {cred_path}")
        return
    
    with open(cred_path) as f:
        all_creds = json.load(f)
    
    credentials = all_creds.get(vendor_id)
    if not credentials:
        print(f"❌ Error: GIG Gulf credentials not found for key: {vendor_id}")
        return
    
    # Initialize adapter and prepare vendor payload
    adapter = Gig_gulfAdapter()
    vendor_payload = adapter.prepare_vendor_payload(test_lead)
    
    # Load vendor config
    vendor_config = vendor_registry.get_config(registry_vendor_id) or {}
    
    # Bot configuration
    bot_config = {
        'headless': False,
        'browser_type': 'chromium',
        'enable_screenshots': False,
        'default_timeout': 60000,
        'navigation_timeout': 90000,
        **vendor_config
    }
    
    print("=" * 60)
    print("GIG Gulf Bot - Fetching Plans")
    print("=" * 60)
    print(f"Lead ID: {lead_id}")
    print(f"Name: {test_lead['firstName']} {test_lead['lastName']}")
    print("=" * 60)
    
    try:
        # Run bot
        async with Gig_gulfBot(credentials=credentials, config=bot_config) as bot:
            print("\n✓ Browser started")
            
            # Step 1: Navigate to portal
            print("→ Navigating to portal...")
            await bot.navigate_to_portal()
            print("✓ Portal navigation complete")
            
            # Step 2: Login
            print("→ Logging in...")
            await bot.login()
            print("✓ Login successful")
            await asyncio.sleep(2)
            
            # Step 3: Fill form
            print("→ Filling insurance form...")
            await bot.fill_insurance_form(vendor_payload)
            print("✓ Form filled successfully")
            await asyncio.sleep(3)
            
            # Step 4: Extract plans (this includes enrichment)
            print("→ Extracting plans...")
            scraper = Gig_gulfScraper(bot.page, bot_config, vendor_payload)
            raw_plans = await scraper.extract_all_plans(bot)
            print(f"✓ Extracted {len(raw_plans)} raw plans")
            
            # Step 5: Normalize plans to standard structure
            print("→ Normalizing plans to standard structure...")
            standard_plans = adapter.normalize_response(raw_plans, lead_id)
            print(f"✓ Normalized {len(standard_plans)} plans")
            
            # Step 6: Save to JSON file
            emirate = test_lead.get('emirate', 'unknown').lower().replace(' ', '-')
            timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
            output_file = Path(__file__).parent.parent.parent.parent / f"gig-gulf-{emirate}-scraped-{timestamp}.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(standard_plans, f, indent=2, ensure_ascii=False)
            
            file_size = output_file.stat().st_size / 1024
            print("\n" + "=" * 60)
            print("✅ SUCCESS")
            print("=" * 60)
            print(f"Plans saved to: {output_file}")
            print(f"Total plans: {len(standard_plans)}")
            print(f"File size: {file_size:.2f} KB")
            print("\nPlan Summary:")
            for i, plan in enumerate(standard_plans, 1):
                print(f"  {i}. {plan.get('planName', 'N/A')} - {plan.get('currency', 'AED')} {plan.get('annualPremium', 0)}")
            print("=" * 60)
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return


if __name__ == '__main__':
    print("Starting GIG Gulf bot to fetch and normalize plans...\n")
    asyncio.run(run_bot_and_save())
