#!/usr/bin/env python3
import asyncio
import os
import subprocess
import time

os.environ['DISPLAY'] = ':0'

from playwright.async_api import async_playwright

def check_chromium_windows():
    """Check if Chromium windows exist"""
    try:
        result = subprocess.run(['wmctrl', '-l'], capture_output=True, text=True)
        windows = [line for line in result.stdout.split('\n') if 'chrom' in line.lower()]
        return windows
    except:
        return []

def take_screenshot():
    """Take a screenshot to prove browser is visible"""
    try:
        subprocess.run(['import', '-window', 'root', '/tmp/browser_test.png'])
        print("  📸 Screenshot saved to /tmp/browser_test.png")
    except:
        print("  ⚠️  Screenshot tool not available")

async def main():
    print("\n" + "="*70)
    print("🔍 BROWSER VISIBILITY DIAGNOSTIC TEST")
    print("="*70)
    
    print("\n1️⃣  Checking environment...")
    print(f"   DISPLAY: {os.environ.get('DISPLAY')}")
    print(f"   USER: {os.environ.get('USER')}")
    
    windows_before = check_chromium_windows()
    print(f"\n2️⃣  Chromium windows BEFORE: {len(windows_before)}")
    
    print("\n3️⃣  Launching Playwright with VISIBLE browser...")
    async with async_playwright() as p:
        print("   • Playwright initialized")
        
        print("   • Launching Chromium with explicit args...")
        browser = await p.chromium.launch(
            headless=False,
            args=[
                '--start-maximized',
                '--window-position=100,100',  # Not at 0,0 so you can see it
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--force-device-scale-factor=1',
                '--disable-gpu'
            ],
            slow_mo=200
        )
        print("   ✅ Browser launched!")
        
        print("\n4️⃣  Waiting 3 seconds for window to appear...")
        await asyncio.sleep(3)
        
        windows_after = check_chromium_windows()
        print(f"\n5️⃣  Chromium windows AFTER launch: {len(windows_after)}")
        for i, win in enumerate(windows_after, 1):
            print(f"      Window {i}: {win[:80]}")
        
        print("\n6️⃣  Creating browser page...")
        context = await browser.new_context(no_viewport=True)
        page = await context.new_page()
        print("   ✅ Page created!")
        
        print("\n7️⃣  Navigating to Google.com...")
        await page.goto('https://www.google.com')
        print("   ✅ Navigation complete!")
        
        print("\n8️⃣  Taking screenshot proof...")
        take_screenshot()
        
        print("\n" + "="*70)
        print("⏸️   BROWSER IS NOW OPEN")
        print("="*70)
        print("\n🔍 WHAT YOU SHOULD SEE:")
        print("   • A Chromium window at position (100, 100) on your screen")
        print("   • The window should be maximized")
        print("   • Google.com should be loaded")
        print("\n❓ IF YOU DON'T SEE THE BROWSER:")
        print("   1. Check if there's a Chromium icon in your taskbar")
        print("   2. Press Alt+Tab to see all windows")
        print("   3. Check /tmp/browser_test.png for screenshot proof")
        print("   4. Try moving your mouse to position (100, 100)")
        print("\n⏲️  Keeping browser open for 30 seconds...")
        print("="*70)
        
        for i in range(30, 0, -1):
            print(f"   Closing in {i:2d} seconds... (Press Ctrl+C to close early)", end='\r')
            await asyncio.sleep(1)
        
        print("\n\n9️⃣  Closing browser...")
        await browser.close()
        print("   ✅ Browser closed!")
        
        print("\n✅ Test complete!")
        print("\nDid you see the browser window? (y/n)")

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n⏹️  Test interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
