"""
Alsagr Plan Scraper Module
Handles extraction of insurance plan details from Alsagr portal
Uses eye button to open modal and capture JSON API response
"""
import asyncio
import os
import re
import time
from typing import List, Dict, Any, Optional
from playwright.async_api import Page
from vendors.base.utils import setup_logging
from vendors.alsagr.parser import AlsagrParser

class AlsagrScraper:
    """
    Scraper class for extracting Alsagr insurance plan details
    Clicks eye button to open modal and captures JSON API response
    """
    
    def __init__(self, page: Page, config: Optional[Dict[str, Any]] = None, form_data: Optional[Dict[str, Any]] = None):
        self.page = page
        self.config = config or {}
        self.form_data = form_data
        self.logger = setup_logging(self.config.get('log_level', 'INFO'))
        self.parser = AlsagrParser()
        self.download_dir = "/tmp/alsagr_downloads"
        os.makedirs(self.download_dir, exist_ok=True)
        try: os.chmod(self.download_dir, 0o777)
        except: pass

    async def extract_all_plans(self, bot) -> List[Dict[str, Any]]:
        self.logger.info("🚀 Starting Alsagr plan extraction...")
        await self.page.wait_for_load_state("networkidle")
        await asyncio.sleep(1)  # Optimized: reduced from 3s to 1s
        
        # Select "All Plan Types" to show all plans
        self.logger.info("Selecting 'All Plan Types'...")
        try:
            await self.page.locator("#planType").select_option("")
            await asyncio.sleep(3)  # Increased wait for plans to load
            await self.page.wait_for_load_state("networkidle")
            self.logger.info("✓ Selected 'All Plan Types'")
        except Exception as e:
            self.logger.warning(f"Could not change plan type: {e}")
        
        # Scroll to bottom to ensure all plan sections/categories are loaded
        # (Portal shows Executive, Standard, Essential, Limited sections)
        self.logger.info("Scrolling to load all plan sections...")
        await self.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await asyncio.sleep(2)  # Wait for any lazy-loaded content
        await self.page.wait_for_load_state("networkidle")
        self.logger.info("✓ Page scrolled to bottom")
        
        # Expand all collapsible plan sections if they exist
        # (Sections may be collapsed: Executive, Standard, Essential, Limited)
        self.logger.info("Checking for collapsible sections...")
        try:
            # Look for common collapse/expand elements
            expand_buttons = await self.page.locator("button:has-text('Expand'), a:has-text('Show'), .collapsed, [data-toggle='collapse']").all()
            if expand_buttons:
                self.logger.info(f"Found {len(expand_buttons)} collapsible sections, expanding...")
                for btn in expand_buttons:
                    try:
                        await btn.click()
                        await asyncio.sleep(0.5)
                    except:
                        pass
                await self.page.wait_for_load_state("networkidle")
                self.logger.info("✓ All sections expanded")
            else:
                self.logger.info("✓ No collapsible sections found (all visible)")
        except Exception as e:
            self.logger.warning(f"Could not expand sections: {e}")
        
        # Find all plan rows - look for Download TOB buttons to count plans
        tob_buttons = await self.page.get_by_title("Download TOB").all()
        num_plans = len(tob_buttons)
        self.logger.info(f"Found {num_plans} TOB buttons (plans) on current view")
        
        # Check if there's pagination or "Load More" functionality
        try:
            # Look for pagination elements
            pagination = await self.page.locator(".pagination, [class*='paging'], [class*='page-'], button:has-text('Load More'), button:has-text('Show More')").count()
            if pagination > 0:
                self.logger.warning(f"⚠️  Pagination elements detected ({pagination} found) - may need pagination support!")
        except:
            pass
        
        structured_plans = []
        
        if num_plans == 0:
            self.logger.error("❌ NO PLANS FOUND!")
            return []

        # Process each plan row
        for index in range(num_plans):
            self.logger.info(f"\nProcessing plan {index + 1}/{num_plans}...")
            
            try:
                # Re-query to get fresh buttons
                tob_buttons = await self.page.get_by_title("Download TOB").all()
                if index >= len(tob_buttons):
                    break
                    
                download_button = tob_buttons[index]
                await download_button.scroll_into_view_if_needed()
                
                # Extract HTML data from row
                plan_number = f"Plan-{index+1}"
                html_premium = "0.00"
                html_plan_name = "Unknown Plan"
                
                try:
                    parent_row = download_button.locator("xpath=./ancestor::tr")
                    row_text = await parent_row.inner_text()
                    lines = [l.strip() for l in row_text.split('\n') if l.strip()]
                    if lines:
                        html_plan_name = lines[0]
                        # Extract plan number
                        plan_num_match = re.match(r'\d+\s+(\d+)\s*-', html_plan_name)
                        if plan_num_match:
                            plan_number = plan_num_match.group(1)
                        else:
                            plan_num_match = re.match(r'(\d+)\s*-', html_plan_name)
                            if plan_num_match:
                                plan_number = plan_num_match.group(1)
                        
                        # Extract premium
                        premium_match = re.search(r'(Platinum|Diamond|Gold|Silver|Bronze|Asasi|ASASI|Executive|Essential|Limited|Standard)\s+([\d,]+\.?\d*)\s*$', html_plan_name, re.IGNORECASE)
                        if premium_match:
                            html_premium = premium_match.group(2).replace(",", "")
                    
                    self.logger.info(f"  Plan: {html_plan_name[:60]}...")
                    
                    # Find the EYE button in the same row
                    # Based on browser_actions.py lines 224-275
                    eye_button = None
                    try:
                        # Add timeout to prevent hanging - Increased to 10s for reliability
                        all_icons = await asyncio.wait_for(
                            parent_row.locator("i").all(),
                            timeout=10.0
                        )
                        self.logger.info(f"  Found {len(all_icons)} icons in row")
                        
                        for icon in all_icons:
                            try:
                                parent_elem = icon.locator("..")
                                parent_title = await asyncio.wait_for(
                                    parent_elem.get_attribute("title"),
                                    timeout=5.0  # Increased to 5s for reliability
                                ) or ""
                                
                                # Skip if it's the download button
                                if "download" not in parent_title.lower():
                                    eye_button = parent_elem
                                    self.logger.info(f"  ✓ Found eye button")
                                    break
                            except asyncio.TimeoutError:
                                self.logger.debug(f"  Timeout getting icon attribute, skipping")
                                continue
                            except:
                                continue
                    except asyncio.TimeoutError:
                        self.logger.warning(f"  Timeout finding icons in row (5s)")  # Updated message
                    except Exception as e:
                        self.logger.warning(f"  Could not find eye button: {e}")
                    
                    if not eye_button:
                        self.logger.warning(f"  ⚠️ No eye button found, skipping plan")
                        continue
                    
                except Exception as e:
                    self.logger.warning(f"  Error extracting row data: {e}")
                    continue
                
                # Capture JSON API response
                json_data = None
                json_captured = False
                
                async def handle_response(response):
                    nonlocal json_data, json_captured
                    try:
                        url = response.url
                        # Capture any plan-related API response (broader pattern)
                        # Looking for: planId, plan, tob, product, quotation endpoints
                        if any(keyword in url.lower() for keyword in ['planid', 'plan', 'tob', 'product', 'quotation']):
                            content_type = response.headers.get('content-type', '').lower()
                            if 'application/json' in content_type:
                                # Log the URL to see what endpoints are being used
                                self.logger.debug(f"  📡 Capturing API: {url[:100]}...")
                                json_data = await response.json()
                                json_captured = True
                                self.logger.info(f"  📥 JSON captured: {len(json_data) if isinstance(json_data, list) else 'object'} items")
                    except:
                        pass
                
                # Use try/finally to ensure listener is ALWAYS removed
                handler_added = False
                try:
                    self.page.on("response", handle_response)
                    handler_added = True
                    
                    # Click eye button to open modal and trigger API
                    self.logger.info(f"  Clicking eye button...")
                    await asyncio.wait_for(eye_button.click(force=True), timeout=10.0)
                    
                    # Wait for modal to appear
                    try:
                        await self.page.wait_for_selector(".modal.show", state="visible", timeout=5000)
                        self.logger.info(f"  ✓ Modal opened")
                    except:
                        self.logger.warning(f"  Modal may not have opened")
                    
                    # Wait for JSON response - Increased to 20s timeout for all plans
                    for _ in range(100):  # 100 × 0.2s = 20s max
                        if json_captured:
                            break
                        await asyncio.sleep(0.2)
                    
                    # Close modal
                    try:
                        await self.page.keyboard.press("Escape")
                        await asyncio.sleep(0.2)  # Optimized: reduced from 0.5s
                    except:
                        pass
                    
                except asyncio.TimeoutError:
                    self.logger.error(f"  ❌ Timeout clicking eye button (10s)")
                except Exception as e:
                    self.logger.error(f"  ❌ Error clicking eye button: {e}")
                finally:
                    # ALWAYS remove listener to prevent memory leaks
                    if handler_added:
                        try:
                            self.page.remove_listener("response", handle_response)
                        except:
                            pass
                
                # Parse JSON data if captured
                if json_captured and json_data:
                    self.logger.info(f"  [PARSING] Processing JSON data...")
                    try:
                        plan = self.parser.parse_json_benefits(
                            json_data=json_data,
                            html_data={
                                'plan_number': plan_number,
                                'html_premium': html_premium,
                                'html_plan_name': html_plan_name
                            },
                            form_data=self.form_data
                        )
                        
                        # Download PDF for additional data extraction
                        pdf_path = await self._download_plan_pdf(download_button, index)
                        if pdf_path:
                            plan['pdf_path'] = pdf_path
                            self.logger.info(f"  ✓ PDF downloaded: {pdf_path}")
                        
                        structured_plans.append(plan)
                        self.logger.info(f"  ✓ Plan parsed successfully from JSON")
                    except Exception as e:
                        self.logger.error(f"  ❌ JSON parse error: {e}")
                else:
                    self.logger.warning(f"  ⚠️ No JSON data captured for this plan")
                
                await asyncio.sleep(0.3)  # Optimized: reduced from 0.5s
                
            except Exception as e:
                self.logger.error(f"Error processing plan {index}: {e}")
                continue

        self.logger.info(f"\n✅ Successfully extracted {len(structured_plans)} plans")
        return structured_plans
    
    async def _download_plan_pdf(self, download_button, index: int) -> Optional[str]:
        """
        Downloads the plan PDF by clicking the download button.
        Returns the path to the downloaded PDF file, or None if download fails.
        """
        try:
            # Construct filename
            import time
            filename = f"plan_{index}_{int(time.time())}.pdf"
            filepath = os.path.join(self.download_dir, filename)
            
            # Click download button and handle popup
            async with self.page.expect_popup() as page1_info:
                await download_button.click()
            
            page1 = await page1_info.value
            await page1.wait_for_load_state("networkidle", timeout=10000)
            
            # If the popup URL is a PDF, download it
            if page1.url.endswith(".pdf"):
                # Get PDF content
                response = await page1.request.fetch(page1.url)
                body = await response.body()
                with open(filepath, "wb") as f:
                    f.write(body)
            else:
                # Fallback: Print to PDF if it's an HTML view
                await page1.pdf(path=filepath)
            
            await page1.close()
            return filepath
            
        except Exception as e:
            self.logger.warning(f"  ⚠️ Failed to download PDF: {e}")
            return None
