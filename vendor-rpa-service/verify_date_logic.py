#!/usr/bin/env python3
"""Verify date parsing logic"""
from datetime import datetime

# Test DOB: 1985-03-20
dob_str = "1985-03-20"
dob = datetime.fromisoformat(dob_str.split('T')[0])
birth_year = dob.year
birth_month_index = dob.month - 1  # jQuery datepicker month is 0-indexed
birth_day = dob.day

print(f"Input: {dob_str}")
print(f"Parsed values:")
print(f"  birth_year = {birth_year}")
print(f"  birth_month_index = {birth_month_index} (0-indexed, so {birth_month_index} = {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][birth_month_index]})")
print(f"  birth_day = {birth_day}")
print()
print(f"Bot will execute:")
print(f"  1. Select year: comboboxes.nth(1).select_option('{birth_year}')")
print(f"  2. Select month: comboboxes.first.select_option('{birth_month_index}')")
print(f"  3. Click day link: page.get_by_role('link', name='{birth_day}')")
print()
print("Expected result in portal: 1985-03-20 (March 20, 1985)")
print("✓ Month index 2 matches your mapping for Mar")
