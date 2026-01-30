#!/usr/bin/env python3
"""
Test Sukoon bot with Sharjah emirate, Germany nationality, 2 members (mother + child)
"""
import asyncio
import json
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent))

from vendors.sukoon.bot import SukoonBot
from vendors.sukoon.scraper import SukoonScraper

async def main():
    # Load credentials
    cred_path = Path(__file__).parent / 'config' / 'credentials.json'
    with open(cred_path) as f:
        all_creds = json.load(f)
    
    credentials = all_creds.get('vendor-sukoon')
    
    # Load test lead data
    test_lead_path = Path(__file__).parent / 'test-leads' / 'sukoon-sharjah-germany-family-test.json'
    with open(test_lead_path) as f:
        lead_data = json.load(f)
    
    print(f"Testing Sukoon bot with lead: {lead_data['leadId']}")
    print(f"Emirate: {lead_data['emirate']}")
    print(f"Members:")
    for i, member in enumerate(lead_data['members'], 1):
        print(f"  {i}. {member['relationship']} - {member['gender']}, DOB: {member['dob']}, {member['nationality']}")
    
    # Configure bot with headless=False for monitoring
    bot_config = {
        'headless': False,
        'browser_type': 'chromium',
        'portalUrl': 'https://individualonline.sukoon.com/SignIn?ReturnUrl=%2Fhealth-insurance%2FHome'
    }
    
    try:
        # Run the bot
        async with SukoonBot(credentials=credentials, config=bot_config) as bot:
            print("\nNavigating to portal...")
            await asyncio.wait_for(bot.navigate_to_portal(), timeout=45.0)
            
            print("Logging in...")
            await asyncio.wait_for(bot.login(), timeout=90.0)
            
            print("Filling insurance form...")
            await asyncio.wait_for(bot.fill_insurance_form(lead_data), timeout=180.0)
            
            print("Scraping plans...")
            scraper = SukoonScraper(bot.page, bot.logger, lead_data)
            plans = await asyncio.wait_for(scraper.extract_all_plans(bot), timeout=60.0)
            
            print(f"\nScraped {len(plans)} plans")
            
            # Save scraped data to JSON file
            output_file = Path(__file__).parent / f"sukoon-sharjah-germany-family-scraped-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
            with open(output_file, 'w') as f:
                json.dump({
                    'leadId': lead_data['leadId'],
                    'emirate': lead_data['emirate'],
                    'members': lead_data['members'],
                    'scrapedAt': datetime.now().isoformat(),
                    'totalPlans': len(plans),
                    'plans': plans
                }, f, indent=2)
            
            print(f"\n✅ Scraped data saved to: {output_file}")
            
            # Print summary
            if plans:
                print("\n📋 Plan Summary:")
                for i, plan in enumerate(plans[:5], 1):  # Show first 5 plans
                    print(f"  {i}. {plan.get('planName', 'N/A')} - Premium: {plan.get('premium', 'N/A')}")
                if len(plans) > 5:
                    print(f"  ... and {len(plans) - 5} more plans")
            
            print("\n✅ Test completed successfully!")
            
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
