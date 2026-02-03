#!/usr/bin/env python3
"""
Run Sukoon bot locally with visible browser (headless=False)
"""
import asyncio
import json
import sys
from pathlib import Path
from datetime import datetime

# Add vendor-rpa-service directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from vendors.sukoon.bot import SukoonBot
from vendors.sukoon.adapter import SukoonAdapter
from vendors.sukoon.scraper import SukoonScraper


async def main():
    """Run Sukoon bot with visible browser"""
    
    # Test lead data - Primary member + 1 dependent (parent)
    lead_data = {
        'id': 'test-lead-sukoon',
        'leadId': 'test-lead-sukoon',
        'lobData': {
            'emirate': 'dubai',
            'dateOfBirth': '1996-10-13',  # 13/10/1996
            'gender': 'Male',
            'maritalStatus': 'Married',
            'nationality': 'India',
            'dependents': [
                {
                    'dateOfBirth': '1973-11-11',  # 11/11/1973
                    'gender': 'Female',
                    'maritalStatus': 'Married',
                    'nationality': 'India',
                    'relationship': 'Parent'
                }
            ]
        }
    }
    
    lead_id = lead_data['id']
    vendor_id = 'vendor-sukoon'
    
    print(f"\n{'='*70}")
    print(f"  SUKOON BOT - VISIBLE BROWSER MODE")
    print(f"{'='*70}\n")
    print(f"Lead ID: {lead_id}")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"\n🔍 Browser window will be VISIBLE - watch your screen!\n")
    
    try:
        # Load credentials
        cred_path = Path(__file__).parent / 'config' / 'credentials.json'
        with open(cred_path) as f:
            all_creds = json.load(f)
        
        credentials = all_creds.get(vendor_id)
        if not credentials:
            raise ValueError(f"Credentials not found for {vendor_id}")
        
        print(f"✓ Loaded credentials")
        
        # Initialize adapter
        adapter = SukoonAdapter()
        vendor_payload = adapter.prepare_vendor_payload(lead_data)
        print(f"✓ Prepared payload with {len(vendor_payload.get('members', []))} member(s)")
        
        # Load config
        config_path = Path(__file__).parent / 'vendors' / 'sukoon' / 'config.json'
        if config_path.exists():
            with open(config_path) as f:
                vendor_config = json.load(f)
        else:
            vendor_config = {}
        
        # Bot configuration - HEADLESS=FALSE
        bot_config = {
            'headless': False,  # <<<< VISIBLE BROWSER FOR MONITORING
            'browser_type': 'chromium',
            'enable_screenshots': True,
            'default_timeout': 60000,
            'navigation_timeout': 90000,
            'slow_mo': 500,  # Slow down for visibility
            **vendor_config
        }
        
        print(f"\n{'='*70}")
        print(f"  STARTING BOT (Visible Browser)")
        print(f"{'='*70}\n")
        
        # Run bot
        async with SukoonBot(credentials=credentials, config=bot_config) as bot:
            print("✓ Browser started\n")
            
            print("[1/5] Navigating to portal...")
            await asyncio.wait_for(bot.navigate_to_portal(), timeout=45.0)
            print("✓ Portal loaded\n")
            
            print("[2/5] Logging in...")
            await asyncio.wait_for(bot.login(), timeout=90.0)
            print("✓ Login successful\n")
            await asyncio.sleep(2)
            
            print("[3/5] Filling insurance form...")
            await asyncio.wait_for(bot.fill_insurance_form(vendor_payload), timeout=180.0)
            print("✓ Form filled\n")
            
            print("[4/5] Waiting for plans to load...")
            await asyncio.sleep(3)
            print("✓ Plans loaded\n")
            
            print("[5/5] Extracting plans...")
            scraper = SukoonScraper(bot.page, bot_config, vendor_payload)
            raw_plans = await asyncio.wait_for(scraper.extract_all_plans(bot), timeout=180.0)
            print(f"✓ Extracted {len(raw_plans)} plans\n")
            
            # Normalize plans
            standard_plans = adapter.normalize_response(raw_plans, lead_id)
            
            # Save to JSON
            output_dir = Path(__file__).parent / 'vendors' / 'sukoon' / 'output'
            output_dir.mkdir(exist_ok=True)
            
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_file = output_dir / f'sukoon_plans_{timestamp}.json'
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'lead_id': lead_id,
                    'vendor_id': vendor_id,
                    'timestamp': datetime.now().isoformat(),
                    'plans': standard_plans,
                    'plan_count': len(standard_plans)
                }, f, indent=2, ensure_ascii=False)
            
            print(f"\n{'='*70}")
            print(f"  SUCCESS")
            print(f"{'='*70}\n")
            print(f"✓ Data saved to: {output_file}")
            print(f"✓ Total plans: {len(standard_plans)}\n")
            
            if standard_plans:
                print("Plans extracted:")
                for idx, plan in enumerate(standard_plans, 1):
                    premium = plan.get('annualPremium', 0)
                    coverage = plan.get('annualLimit', 0)
                    print(f"  {idx}. {plan.get('planName', 'Unknown')} - {premium:,.0f} AED/year ({coverage:,.0f} AED coverage)")
            
            print(f"\n{'='*70}\n")
            print("Browser will close in 15 seconds...")
            await asyncio.sleep(15)
    
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())
