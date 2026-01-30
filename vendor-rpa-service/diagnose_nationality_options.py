#!/usr/bin/env python3
"""
Diagnose what nationality options are available in the dropdown
"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from vendors.sukoon.bot import SukoonBot

async def main():
    cred_path = Path(__file__).parent / 'config' / 'credentials.json'
    with open(cred_path) as f:
        all_creds = json.load(f)
    credentials = all_creds.get('vendor-sukoon')
    
    bot_config = {
        'headless': False,
        'browser_type': 'chromium',
        'portalUrl': 'https://individualonline.sukoon.com/SignIn?ReturnUrl=%2Fhealth-insurance%2FHome'
    }
    
    print("[DIAGNOSE] Checking nationality dropdown options")
    
    try:
        async with SukoonBot(credentials=credentials, config=bot_config) as bot:
            await asyncio.wait_for(bot.navigate_to_portal(), timeout=45.0)
            await asyncio.wait_for(bot.login(), timeout=90.0)
            await bot.page.wait_for_timeout(2000)
            
            # Navigate to form
            await bot.page.get_by_role("button", name="Premium Calculator").click()
            await bot.page.wait_for_timeout(1000)
            await bot.page.get_by_role("link", name="HealthPlus").click()
            await bot.page.wait_for_load_state("domcontentloaded", timeout=60000)
            await bot.page.wait_for_timeout(2000)
            
            # Select emirate and gender to make nationality dropdown available
            await bot.page.locator("#ContentContainer_MainContent_ucQuickQuote_DropDownList1").select_option("5")
            await bot.page.locator("#ContentContainer_MainContent_ucQuickQuote_grdPremiumCalculation_btnMale_0").click()
            await bot.page.wait_for_timeout(1000)
            
            # Get nationality dropdown options
            nationality_selector = "#ContentContainer_MainContent_ucQuickQuote_grdPremiumCalculation_ddlNationality_0"
            await bot.page.locator(nationality_selector).wait_for(state="visible", timeout=5000)
            
            # Wait a bit more for options to load (in case it's dynamic)
            await bot.page.wait_for_timeout(2000)
            
            options = await bot.page.locator(f"{nationality_selector} option").all()
            print(f"\n[FOUND] {len(options)} nationality options:\n")
            
            for i, option in enumerate(options):
                value = await option.get_attribute("value")
                text = await option.text_content()
                print(f"{i:3d}. value='{value}' | text='{text}'")
                
                # Look for India specifically
                if text and 'india' in text.lower():
                    print(f"     👆 FOUND INDIA-LIKE OPTION!")
            
            print("\n[DIAGNOSE] Browser will stay open for 10 seconds...")
            await asyncio.sleep(10)
    
    except Exception as e:
        print(f"\n[ERROR] {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(main())
