#!/usr/bin/env python3
"""
Diagnose exact year selection issue - find why 1997 is selected instead of 1998
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
    
    print("[DIAGNOSE] Testing year 1998 selection...")
    
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
            await bot.page.wait_for_timeout(1000)
            
            # Get dropdowns
            datepicker = bot.page.locator("#ui-datepicker-div")
            comboboxes = datepicker.get_by_role("combobox")
            year_dropdown = comboboxes.nth(1)
            month_dropdown = comboboxes.first
            
            print("\n[TEST 1] Trying to select year 1998 by value")
            await year_dropdown.select_option("1998")
            await bot.page.wait_for_timeout(500)
            
            # Check what was actually selected
            selected_value = await year_dropdown.input_value()
            selected_text = await year_dropdown.evaluate("el => el.options[el.selectedIndex].text")
            print(f"  Requested: '1998'")
            print(f"  Selected value: '{selected_value}'")
            print(f"  Selected text: '{selected_text}'")
            
            if selected_value != "1998":
                print(f"\n  ⚠️  MISMATCH! Requested 1998 but got {selected_value}")
                
                # Check if index-based selection works
                print("\n[TEST 2] Finding index of year 1998")
                options = await year_dropdown.locator("option").all()
                for i, option in enumerate(options):
                    value = await option.get_attribute("value")
                    text = await option.text_content()
                    if "1998" in text:
                        print(f"  Year 1998 found at index {i}: value='{value}', text='{text}'")
                        
                        print(f"\n[TEST 3] Trying to select by index {i}")
                        await year_dropdown.select_option(index=i)
                        await bot.page.wait_for_timeout(500)
                        
                        selected_value2 = await year_dropdown.input_value()
                        selected_text2 = await year_dropdown.evaluate("el => el.options[el.selectedIndex].text")
                        print(f"  Selected value: '{selected_value2}'")
                        print(f"  Selected text: '{selected_text2}'")
                        break
            
            print("\n[DIAGNOSE] Browser will stay open for 10 seconds - verify the year in datepicker")
            await asyncio.sleep(10)
    
    except Exception as e:
        print(f"\n[ERROR] {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(main())
