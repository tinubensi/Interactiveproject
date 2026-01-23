#!/usr/bin/env python3
"""
Diagnostic script to see what's on the GIG Gulf login page
"""
import asyncio
from playwright.async_api import async_playwright


async def diagnose():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        url = "https://health.gig-gulf.com/externalsso/ids/login?signin=9ce8a2f322c206f6c8c3db7b56c677b1"
        print(f"Navigating to: {url}")
        
        await page.goto(url)
        print(f"Current URL: {page.url}")
        
        # Wait a bit
        await asyncio.sleep(5)
        
        print("\n=== Page Analysis ===")
        
        # Check title
        title = await page.title()
        print(f"Page title: {title}")
        
        # Check for inputs
        inputs = await page.locator("input").count()
        print(f"Number of input elements: {inputs}")
        
        if inputs > 0:
            for i in range(min(inputs, 5)):
                inp = page.locator("input").nth(i)
                inp_type = await inp.get_attribute("type") or "text"
                inp_name = await inp.get_attribute("name") or "N/A"
                inp_id = await inp.get_attribute("id") or "N/A"
                inp_placeholder = await inp.get_attribute("placeholder") or "N/A"
                print(f"  Input {i+1}: type={inp_type}, name={inp_name}, id={inp_id}, placeholder={inp_placeholder}")
        
        # Check for buttons
        buttons = await page.locator("button").count()
        print(f"Number of button elements: {buttons}")
        
        if buttons > 0:
            for i in range(min(buttons, 5)):
                btn = page.locator("button").nth(i)
                btn_text = await btn.inner_text()
                print(f"  Button {i+1}: {btn_text[:50]}")
        
        # Check for iframes
        frames = page.frames
        print(f"Number of frames: {len(frames)}")
        for i, frame in enumerate(frames[:3]):
            print(f"  Frame {i+1}: {frame.url[:100]}")
        
        # Save page content
        content = await page.content()
        with open("/tmp/gig_gulf_page.html", "w") as f:
            f.write(content)
        print(f"\nPage HTML saved to: /tmp/gig_gulf_page.html")
        print(f"HTML length: {len(content)} characters")
        
        # Take screenshot
        await page.screenshot(path="/tmp/gig_gulf_page.png", full_page=True)
        print(f"Screenshot saved to: /tmp/gig_gulf_page.png")
        
        print("\n=== Waiting 30 seconds for manual inspection ===")
        print("Check the browser window to see what's displayed")
        await asyncio.sleep(30)
        
        await browser.close()


if __name__ == "__main__":
    asyncio.run(diagnose())
