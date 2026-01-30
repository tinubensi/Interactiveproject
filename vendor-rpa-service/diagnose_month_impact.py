#!/usr/bin/env python3
"""
Diagnose if month selection changes the year
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
    
    print("[DIAGNOSE] Testing if month selection changes year...")
    print("[TARGET] Year: 1998, Month: April (index 3)")
    
    try:
        async with SukoonBot(credentials=credentials, config=bot_config) as bot:
            await asyncio.wait_for(bot.navigate_to_portal(), timeout=45.0)
            await asyncio.wait_for(bot.login(), timeout=90.0)
            await asyncio.sleep(2)
            
            # Navigate to form
            await bot.page.get_by_role("button", name="Premium Calculator").click()
            await bot.page.wait_for_timeout(1000)
            await bot.page.get_by_role("link", name="HealthPlus").click()
            await bot.page.wait_for_load_state("domcontentloaded", timeout=60000)
            await bot.page.wait_for_timeout(2000)
            
            # Select emirate
            await bot.page.locator("#ContentContainer_MainContent_ucQuickQuote_DropDownList1").select_option("5")
            
            # Click Male button
            await bot.page.locator("#ContentContainer_MainContent_ucQuickQuote_grdPremiumCalculation_btnMale_0").click()
            await bot.page.wait_for_timeout(500)
            
            # Click DOB field
            dob_field = bot.page.get_by_placeholder("Date of Birth").first
            await dob_field.click()
            await bot.page.wait_for_timeout(1500)
            
            # Get dropdowns
            datepicker = bot.page.locator("#ui-datepicker-div")
            comboboxes = datepicker.get_by_role("combobox")
            year_dropdown = comboboxes.nth(1)
            month_dropdown = comboboxes.first
            
            print("\n[STEP 1] Select year 1998")
            await year_dropdown.select_option("1998")
            await bot.page.wait_for_timeout(500)
            year_after_year_select = await year_dropdown.input_value()
            print(f"  Year after selecting year: {year_after_year_select}")
            
            print("\n[STEP 2] Select month April (index 3)")
            await month_dropdown.select_option("3")
            await bot.page.wait_for_timeout(800)
            year_after_month_select = await year_dropdown.input_value()
            month_after_month_select = await month_dropdown.input_value()
            print(f"  Year after selecting month: {year_after_month_select}")
            print(f"  Month after selecting month: {month_after_month_select}")
            
            if year_after_month_select != "1998":
                print(f"\n  🔴 ISSUE FOUND! Year changed from {year_after_year_select} to {year_after_month_select} after month selection!")
                print(f"  This is the root cause of the year mismatch!")
            else:
                print(f"\n  ✓ Year remained 1998 after month selection")
            
            print("\n[DIAGNOSE] Browser stays open for 10 seconds - verify in portal")
            await asyncio.sleep(10)
    
    except Exception as e:
        print(f"\n[ERROR] {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(main())
