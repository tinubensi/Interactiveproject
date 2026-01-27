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

        # Limit PDF downloads to first 10 plans (download event is fast, but still limit for efficiency)
        max_pdf_downloads = min(10, num_plans)
        self.logger.info(f"📥 Will download PDFs for first {max_pdf_downloads} plans using download events (fast, no tabs)")
        
        # Process each plan row
        for index in range(num_plans):
            self.logger.info(f"\nProcessing plan {index + 1}/{num_plans}...")
            
            # Close any extra tabs/pages before processing next plan
            await self._close_all_extra_pages()
            
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
                    
                    # CRITICAL: Ensure no modals are open before clicking
                    try:
                        modal_open = await self.page.locator(".modal.show").count() > 0
                        if modal_open:
                            self.logger.debug(f"  Previous modal still open, closing...")
                            await self.page.keyboard.press("Escape")
                            await asyncio.sleep(1)
                            await self.page.wait_for_selector(".modal.show", state="hidden", timeout=3000)
                    except:
                        pass
                    
                    # CRITICAL: Scroll element into view before clicking
                    await eye_button.scroll_into_view_if_needed()
                    await asyncio.sleep(0.3)
                    
                    # Click eye button to open modal and trigger API
                    self.logger.info(f"  Clicking eye button...")
                    try:
                        # Try regular click first
                        await asyncio.wait_for(eye_button.click(), timeout=5.0)
                    except:
                        # Fallback to force click if regular click fails
                        self.logger.debug(f"  Regular click failed, trying force click...")
                        await asyncio.wait_for(eye_button.click(force=True), timeout=5.0)
                    
                    # Wait for modal to appear
                    try:
                        await self.page.wait_for_selector(".modal.show", state="visible", timeout=8000)
                        self.logger.info(f"  ✓ Modal opened")
                    except:
                        self.logger.warning(f"  Modal may not have opened")
                        # Try clicking again
                        try:
                            await eye_button.click(force=True)
                            await self.page.wait_for_selector(".modal.show", state="visible", timeout=5000)
                            self.logger.info(f"  ✓ Modal opened on retry")
                        except:
                            self.logger.warning(f"  Modal still not opening after retry")
                    
                    # Wait for JSON response - 5s max (optimized)
                    for _ in range(25):  # 25 × 0.2s = 5s max
                        if json_captured:
                            break
                        await asyncio.sleep(0.2)
                    
                    # Close modal - CRITICAL for next plan to work
                    try:
                        # Method 1: Try clicking the close button (X)
                        close_button = self.page.locator("button.btn-close, button[data-bs-dismiss='modal'], .modal button.close").first
                        if await close_button.count() > 0:
                            await close_button.click(timeout=2000)
                            self.logger.debug(f"  Clicked close button")
                        else:
                            # Method 2: Press Escape key
                            await self.page.keyboard.press("Escape")
                            self.logger.debug(f"  Pressed Escape key")
                        
                        # CRITICAL: Wait for modal to fully disappear
                        await asyncio.sleep(0.5)
                        await self.page.wait_for_selector(".modal.show", state="hidden", timeout=5000)
                        self.logger.debug(f"  ✓ Modal closed successfully")
                        
                        # Extra safety wait for DOM to settle
                        await asyncio.sleep(0.5)
                    except Exception as e:
                        # Fallback: Force close with multiple escape presses
                        self.logger.warning(f"  Modal close issue: {e}, forcing close...")
                        try:
                            await self.page.keyboard.press("Escape")
                            await asyncio.sleep(0.5)
                            await self.page.keyboard.press("Escape")
                            await asyncio.sleep(1)
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
                        
                        # Download PDF for additional data extraction (only for first N plans)
                        # Using download event method - fast and no tabs opened
                        if index < max_pdf_downloads:
                            pdf_path = await self._download_plan_pdf(download_button, index)
                            if pdf_path:
                                plan['pdf_path'] = pdf_path
                                self.logger.info(f"  ✓ PDF downloaded: {pdf_path}")
                        else:
                            self.logger.info(f"  ⏭️  Skipping PDF download (limit reached: {max_pdf_downloads})")
                        
                        structured_plans.append(plan)
                        self.logger.info(f"  ✓ Plan parsed successfully from JSON")
                    except Exception as e:
                        self.logger.error(f"  ❌ JSON parse error: {e}")
                else:
                    self.logger.warning(f"  ⚠️ No JSON data captured for this plan")
                
                # Wait between plans for UI stability (optimized for speed)
                await asyncio.sleep(0.8)  # Balanced for speed vs stability
                
            except Exception as e:
                self.logger.error(f"Error processing plan {index}: {e}")
                continue

        # Final cleanup: Close all extra tabs before returning
        await self._close_all_extra_pages()
        
        self.logger.info(f"\n✅ Successfully extracted {len(structured_plans)} plans")
        return structured_plans
    
    async def _close_all_extra_pages(self):
        """
        Closes all pages/tabs except the main page to prevent tab accumulation.
        """
        try:
            # Get context from the page
            context = self.page.context
            if not context:
                return
            
            pages = context.pages
            main_page = self.page
            
            # Close all pages except the main one
            for page in pages:
                if page != main_page and not page.is_closed():
                    try:
                        await page.close()
                        self.logger.debug(f"  🗑️  Closed extra tab/page")
                    except Exception as e:
                        self.logger.debug(f"  ⚠️  Could not close page: {e}")
        except Exception as e:
            self.logger.debug(f"  ⚠️  Error closing extra pages: {e}")
    
    async def _download_plan_pdf(self, download_button, index: int) -> Optional[str]:
        """
        Downloads the plan PDF using download event (fastest method, works in headless mode).
        Returns the path to the downloaded PDF file, or None if download fails.
        """
        try:
            # Construct filename
            import time
            filename = f"plan_{index}_{int(time.time())}.pdf"
            filepath = os.path.join(self.download_dir, filename)
            
            # PRIMARY STRATEGY: Use download event handler (fastest, works in headless mode)
            pdf_downloaded = False
            downloaded_path = None
            
            async def handle_download(download):
                nonlocal pdf_downloaded, downloaded_path
                try:
                    self.logger.info(f"  📥 Download event triggered")
                    # Try to get suggested filename (might be property or method)
                    try:
                        if hasattr(download, 'suggested_filename'):
                            if callable(download.suggested_filename):
                                suggested_filename = download.suggested_filename()
                            else:
                                suggested_filename = download.suggested_filename
                            self.logger.debug(f"  📄 Suggested filename: {suggested_filename}")
                    except:
                        pass
                    
                    # Save the download
                    await download.save_as(filepath)
                    pdf_downloaded = True
                    downloaded_path = filepath
                    file_size = os.path.getsize(filepath) if os.path.exists(filepath) else 0
                    self.logger.info(f"  ✅ PDF downloaded via download event: {file_size} bytes")
                except Exception as e:
                    self.logger.warning(f"  Download handler error: {e}")
            
            # Register download handler BEFORE clicking
            self.page.on("download", handle_download)
            
            try:
                self.logger.info(f"  🔘 Clicking download button (download event method)...")
                # Click the download button
                await download_button.click()
                
                # Wait for download to complete (max 5 seconds - faster)
                self.logger.debug(f"  Waiting for download event (max 5s)...")
                for i in range(10):  # 10 × 0.5s = 5s max
                    if pdf_downloaded:
                        self.logger.debug(f"  ✅ Download completed after {i * 0.5:.1f}s")
                        break
                    await asyncio.sleep(0.5)
                
                # Remove download handler
                self.page.remove_listener("download", handle_download)
                
                if pdf_downloaded and downloaded_path and os.path.exists(downloaded_path):
                    file_size = os.path.getsize(downloaded_path)
                    if file_size > 1000:  # Verify PDF is not empty
                        self.logger.info(f"  ✅ PDF saved: {os.path.basename(downloaded_path)} ({file_size} bytes)")
                        return downloaded_path
                    else:
                        self.logger.warning(f"  ⚠️ Downloaded file too small ({file_size} bytes), may be invalid")
                else:
                    self.logger.debug(f"  ⚠️ Download event did not fire or file not found")
                
            except Exception as e:
                self.logger.warning(f"  Download event approach failed: {e}")
                # Remove handler on error
                try:
                    self.page.remove_listener("download", handle_download)
                except:
                    pass
            
            # FALLBACK: Only try network interception if download event failed
            # (Skip popup approach to avoid opening tabs)
            try:
                self.logger.debug("  Trying network interception fallback...")
                pdf_url = None
                pdf_body = None
                
                async def handle_response(response):
                    nonlocal pdf_url, pdf_body
                    try:
                        content_type = response.headers.get('content-type', '').lower()
                        url = response.url
                        if 'application/pdf' in content_type or url.endswith('.pdf'):
                            pdf_url = url
                            pdf_body = await response.body()
                            if pdf_body.startswith(b'%PDF'):
                                self.logger.info(f"  📥 Captured PDF from network: {len(pdf_body)} bytes")
                    except:
                        pass
                
                self.page.on("response", handle_response)
                
                # Click again to trigger network request
                await download_button.click()
                await asyncio.sleep(2)  # Wait for network request
                
                # Remove handler
                self.page.remove_listener("response", handle_response)
                
                if pdf_body and pdf_body.startswith(b'%PDF'):
                    with open(filepath, "wb") as f:
                        f.write(pdf_body)
                    self.logger.info(f"  ✅ PDF downloaded via network interception: {len(pdf_body)} bytes")
                    return filepath
                    
            except Exception as e:
                self.logger.debug(f"  Network interception fallback failed: {e}")
            
            self.logger.warning(f"  ⚠️ PDF download failed (download event + network interception)")
            return None
            
        except Exception as e:
            self.logger.warning(f"  ⚠️ Failed to download PDF: {e}")
            return None
