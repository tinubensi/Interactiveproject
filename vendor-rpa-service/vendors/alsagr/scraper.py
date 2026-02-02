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
from vendors.alsagr.pdf_parser import parse_plan_pdf

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
    
    def validate_plan(self, plan_data: Dict[str, Any], plan_index: int) -> List[str]:
        """
        Validates extracted plan data for completeness and quality.
        
        Args:
            plan_data: The extracted plan data
            plan_index: Index of the plan for logging
        
        Returns:
            List of validation issues (empty if no issues)
        """
        issues = []
        
        # Validate numeric fields
        if plan_data.get("annualPremium", 0) == 0:
            issues.append("Premium not extracted")
        if plan_data.get("annualLimit", 0) == 0:
            issues.append("Annual limit not extracted")
        if plan_data.get("inpatientLimit", 0) == 0:
            issues.append("Inpatient limit not extracted")
        
        # Validate text quality in lobSpecificData
        if "lobSpecificData" in plan_data:
            lob_data = plan_data["lobSpecificData"]
            
            # Alternative Medicine
            if "alternativeMedicine" in lob_data:
                alt_med = lob_data["alternativeMedicine"]
                desc = alt_med.get("description", "")
                if desc and len(desc) < 50:
                    issues.append(f"Alternative medicine description too short ({len(desc)} chars)")
                if desc and desc.count('.') > len(desc) * 0.05:
                    issues.append("Alternative medicine has excessive punctuation artifacts")
            
            # Claims Settlement Basis
            if "claimsSettlementBasis" in lob_data:
                claims = lob_data["claimsSettlementBasis"]
                desc = claims.get("description", "")
                if desc and len(desc) < 80:
                    issues.append(f"Claims settlement description too short ({len(desc)} chars)")
                if desc and desc.count('.') > len(desc) * 0.05:
                    issues.append("Claims settlement has excessive punctuation artifacts")
            
            # Physiotherapy
            if "physiotherapy" in lob_data:
                physio = lob_data["physiotherapy"]
                if physio and len(physio) < 20:
                    issues.append(f"Physiotherapy description too short ({len(physio)} chars)")
        
        # Log issues if any
        if issues:
            self.logger.warning(f"  ⚠️ Plan {plan_index + 1} validation issues: {', '.join(issues)}")
        else:
            self.logger.info(f"  ✅ Plan {plan_index + 1} passed validation")
        
        return issues

    async def extract_all_plans(self, bot) -> List[Dict[str, Any]]:
        self.logger.info("🚀 Starting Alsagr plan extraction...")
        
        # FIX 1: Wait for results page to load FIRST before trying to interact with elements
        self.logger.info("⏳ Waiting for results page to load...")
        try:
            # Wait for any of these elements (results page indicators)
            await self.page.wait_for_selector(
                "#planType, .tob-button, [title='Download TOB'], .plan-card, .plan-row, table",
                timeout=30000,
                state="visible"
            )
            self.logger.info("✓ Results page loaded")
        except Exception as e:
            self.logger.error(f"❌ Results page did not load: {e}")
            
            # Check for error messages on page
            error_selectors = [
                ".alert-danger", ".error-message", 
                "text=No plans available", "text=Invalid", "text=Error"
            ]
            for selector in error_selectors:
                if await self.page.locator(selector).count() > 0:
                    try:
                        error_text = await self.page.locator(selector).text_content()
                        self.logger.error(f"Page error: {error_text}")
                    except:
                        pass
                    break
            
            # Take screenshot for debugging
            try:
                screenshot_path = "/tmp/alsagr_results_page_error.png"
                await self.page.screenshot(path=screenshot_path, full_page=True)
                self.logger.error(f"Screenshot saved: {screenshot_path}")
            except:
                pass
            
            return []
        
        await self.page.wait_for_load_state("networkidle")
        await asyncio.sleep(1)
        
        # DEBUG: Log current page URL
        current_url = self.page.url
        self.logger.info(f"📍 Current page URL: {current_url}")
        
        # DEBUG: Check for error messages on the page
        try:
            page_text = await self.page.inner_text("body")
            if "no plans" in page_text.lower() or "error" in page_text.lower() or "not available" in page_text.lower():
                self.logger.warning(f"⚠️  Page may contain error message. Preview: {page_text[:500]}")
        except Exception as e:
            self.logger.debug(f"Could not read page text: {e}")
        
        # FIX 2: Plan type selection is now optional with proper timeout
        self.logger.info("Selecting 'All Plan Types'...")
        try:
            # First check if the element exists
            plan_type_count = await self.page.locator("#planType").count()
            if plan_type_count > 0:
                # Add 5 second timeout to prevent hanging
                await self.page.locator("#planType").select_option("", timeout=5000)
                await asyncio.sleep(2)
                await self.page.wait_for_load_state("networkidle")
                self.logger.info("✓ Selected 'All Plan Types'")
            else:
                self.logger.info("ℹ️  Plan type dropdown not found - continuing anyway")
        except Exception as e:
            self.logger.warning(f"Could not change plan type: {e} - continuing anyway")
        
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
        
        # FIX 3: Try multiple selectors for TOB buttons (more robust)
        tob_buttons = []
        selectors_to_try = [
            '[title="Download TOB"]',  # Primary selector
            '.tob-button',
            'button[onclick*="TOB"]',
            'a[onclick*="TOB"]',
            '[data-action="download-tob"]',
            '.btn-tob'
        ]
        
        for selector in selectors_to_try:
            try:
                tob_buttons = await self.page.locator(selector).all()
                if len(tob_buttons) > 0:
                    self.logger.info(f"✓ Found {len(tob_buttons)} plans using selector: {selector}")
                    break
            except:
                pass
        
        num_plans = len(tob_buttons)
        
        # Fallback to get_by_title if no buttons found
        if num_plans == 0:
            self.logger.info("No plans found with selectors, trying get_by_title fallback...")
            try:
                tob_buttons = await self.page.get_by_title("Download TOB").all()
                num_plans = len(tob_buttons)
                if num_plans > 0:
                    self.logger.info(f"✓ Found {num_plans} plans using get_by_title")
            except:
                pass
        
        self.logger.info(f"Total plans found: {num_plans}")
        
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
            
            # Take screenshot to see what went wrong
            try:
                screenshot_path = f"/tmp/alsagr_no_plans_{int(time.time())}.png"
                await self.page.screenshot(path=screenshot_path, full_page=True)
                self.logger.error(f"📸 Screenshot saved: {screenshot_path}")
                
                # Log page content to help debug
                page_content = await self.page.content()
                self.logger.error(f"📄 Page URL: {self.page.url}")
                
                # Check for error messages on the page
                error_messages = await self.page.locator(".alert-danger, .error, .validation-error").all_text_contents()
                if error_messages:
                    self.logger.error(f"⚠️ Error messages found on page: {error_messages}")
                
                # Check if there's a message saying no plans available
                page_text = await self.page.locator("body").inner_text()
                if "no plan" in page_text.lower() or "not available" in page_text.lower():
                    self.logger.error(f"ℹ️  Portal message: No plans available for this combination")
                    
            except Exception as debug_error:
                self.logger.error(f"Failed to capture debug info: {debug_error}")
            
            return []

        # Download PDFs for ALL plans to ensure Alternative Medicine and Claims Settlement Basis are extracted
        # (These fields are only available in PDFs, not in JSON API)
        max_pdf_downloads = num_plans
        self.logger.info(f"📥 Will download PDFs for all {max_pdf_downloads} plans using download events (fast, no tabs)")
        
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
                        
                        # Extract premium using multiple patterns (fixes low-premium plan extraction)
                        premium_patterns = [
                            # Pattern 1: Plan tier name + premium at end (original)
                            r'(Platinum|Diamond|Gold|Silver|Bronze|Asasi|ASASI|Executive|Essential|Limited|Standard)\s+([\d,]+\.?\d+)\s*$',
                            # Pattern 2: Any number at end of string (fallback)
                            r'([\d,]+\.?\d+)\s*$',
                            # Pattern 3: Premium after last dash
                            r'-\s*([A-Za-z]+\s+)?(\d[\d,]*\.?\d*)\s*$',
                            # Pattern 4: Premium with AED keyword
                            r'AED\s*([\d,]+\.?\d+)',
                            # Pattern 5: Just last numeric value
                            r'(\d{3,}\.?\d*)\s*$',
                        ]
                        
                        for pattern in premium_patterns:
                            premium_match = re.search(pattern, html_plan_name, re.IGNORECASE)
                            if premium_match:
                                # Extract the numeric part (could be in different group depending on pattern)
                                for group in premium_match.groups():
                                    if group and re.match(r'^[\d,]+\.?\d*$', str(group)):
                                        extracted_value = str(group).replace(",", "")
                                        try:
                                            premium_float = float(extracted_value)
                                            # Validate premium is in reasonable range (100 to 50000 AED)
                                            if 100 <= premium_float <= 50000:
                                                html_premium = extracted_value
                                                self.logger.debug(f"  Premium extracted: {html_premium} (pattern: {pattern[:50]}...)")
                                                break
                                        except ValueError:
                                            continue
                                if html_premium != "0.00":
                                    break
                        
                        # Fallback: Try extracting premium from table cells
                        if html_premium == "0.00":
                            try:
                                cells = await parent_row.locator("td").all()
                                for cell in cells:
                                    cell_text = await cell.inner_text()
                                    cell_text = cell_text.strip().replace(",", "")
                                    # Look for cells with just numbers
                                    if re.match(r'^[\d]+\.?\d*$', cell_text):
                                        try:
                                            premium_float = float(cell_text)
                                            if 100 <= premium_float <= 50000:
                                                html_premium = cell_text
                                                self.logger.debug(f"  Premium extracted from table cell: {html_premium}")
                                                break
                                        except ValueError:
                                            continue
                            except Exception as cell_error:
                                self.logger.debug(f"  Could not extract from table cells: {cell_error}")
                        
                        # Log warning if premium still not found
                        if html_premium == "0.00":
                            self.logger.warning(f"  ⚠️ Premium extraction failed for: {html_plan_name[:100]}")
                    
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
                                try:
                                    json_data = await response.json()
                                    json_captured = True
                                    self.logger.info(f"  📥 JSON captured: {len(json_data) if isinstance(json_data, list) else 'object'} items")
                                except Exception as json_err:
                                    self.logger.warning(f"  Failed to parse JSON from {url[:50]}: {json_err}")
                    except Exception as e:
                        self.logger.debug(f"  Response handler error: {e}")
                
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
                    
                    # Wait for JSON response - 10s max (increased for reliability)
                    for _ in range(50):  # 50 × 0.2s = 10s max
                        if json_captured:
                            break
                        await asyncio.sleep(0.2)
                    
                    # Close modal - CRITICAL for next plan to work
                    # IMPROVED: Multiple strategies with verification
                    modal_closed = False
                    
                    # Strategy 1: Try clicking close button
                    try:
                        close_button = self.page.locator("button.btn-close, button[data-bs-dismiss='modal'], .modal button.close").first
                        if await close_button.count() > 0:
                            # Use force=True to bypass overlay issues
                            await close_button.click(force=True, timeout=3000)
                            self.logger.debug(f"  Clicked close button (force)")
                            await asyncio.sleep(0.5)
                            
                            # Verify modal is hidden
                            modal_count = await self.page.locator(".modal.show").count()
                            if modal_count == 0:
                                modal_closed = True
                                self.logger.debug(f"  ✓ Modal closed via button")
                    except Exception as e:
                        self.logger.debug(f"  Close button failed: {e}")
                    
                    # Strategy 2: Press Escape if button failed
                    if not modal_closed:
                        try:
                            await self.page.keyboard.press("Escape")
                            await asyncio.sleep(1.0)  # Balanced wait for modal to close
                            
                            # Verify
                            modal_count = await self.page.locator(".modal.show").count()
                            if modal_count == 0:
                                modal_closed = True
                                self.logger.debug(f"  ✓ Modal closed via Escape")
                        except Exception as e:
                            self.logger.debug(f"  Escape failed: {e}")
                    
                    # Strategy 3: Force close via JavaScript if still open
                    if not modal_closed:
                        try:
                            self.logger.warning(f"  ⚠️ Modal still open, forcing via JavaScript...")
                            # Forcibly hide modal and remove backdrop via JavaScript
                            await self.page.evaluate("""
                                () => {
                                    // Hide all modals
                                    document.querySelectorAll('.modal').forEach(m => {
                                        m.classList.remove('show');
                                        m.style.display = 'none';
                                    });
                                    // Remove all modal backdrops
                                    document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
                                    // Remove modal-open class from body
                                    document.body.classList.remove('modal-open');
                                    document.body.style.overflow = '';
                                }
                            """)
                            await asyncio.sleep(0.5)
                            modal_closed = True
                            self.logger.debug(f"  ✓ Modal force-closed via JavaScript")
                        except Exception as e:
                            self.logger.warning(f"  JavaScript close failed: {e}")
                    
                    # Final verification and extra wait for DOM to settle
                    if modal_closed:
                        await asyncio.sleep(0.8)  # Optimized wait for animations
                        self.logger.debug(f"  ✓ Modal fully closed, ready for next plan")
                    else:
                        self.logger.warning(f"  ⚠️ Could not confirm modal closed, continuing anyway...")
                        await asyncio.sleep(1.5)  # Extra wait if uncertain
                    
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
                        # WITH RETRY LOGIC for reliability
                        if index < max_pdf_downloads:
                            pdf_path = None
                            max_retries = 2  # Try up to 2 times total (1 retry)
                            
                            for attempt in range(max_retries):
                                if attempt > 0:
                                    self.logger.info(f"  🔄 Retry {attempt}/{max_retries-1} for PDF download...")
                                    # Wait before retry
                                    await asyncio.sleep(1.0)  # Reduced from 2s to 1s
                                
                                pdf_path = await self._download_plan_pdf(download_button, index)
                                
                                if pdf_path:
                                    plan['pdf_path'] = pdf_path
                                    self.logger.info(f"  ✓ PDF downloaded: {pdf_path}")
                                    
                                    # Parse PDF to extract benefits data
                                    try:
                                        self.logger.info(f"  📄 Parsing PDF to extract benefits...")
                                        plan = await parse_plan_pdf(pdf_path, plan)
                                        self.logger.info(f"  ✅ PDF parsed successfully - benefits extracted")
                                    except Exception as pdf_error:
                                        self.logger.error(f"  ❌ PDF parsing failed: {pdf_error}")
                                        import traceback
                                        self.logger.error(f"  Traceback: {traceback.format_exc()}")
                                    
                                    break  # Success, exit retry loop
                                else:
                                    if attempt < max_retries - 1:
                                        self.logger.warning(f"  ⚠️ PDF download failed, will retry...")
                                    else:
                                        self.logger.warning(f"  ⚠️ PDF download failed after {max_retries} attempts")
                        else:
                            self.logger.info(f"  ⏭️  Skipping PDF download (limit reached: {max_pdf_downloads})")
                        
                        # Validate plan data quality
                        validation_issues = self.validate_plan(plan, index)
                        
                        # Enhanced logging for plan data
                        self.logger.info(f"  ✓ Plan parsed successfully from JSON")
                        self.logger.info(f"  Plan Name: {plan.get('planName', 'Unknown')}")
                        self.logger.info(f"  Premium: AED {plan.get('annualPremium', 0):,.2f}")
                        self.logger.info(f"  Annual Limit: AED {plan.get('annualLimit', 0):,.0f}")
                        self.logger.info(f"  Inpatient Limit: AED {plan.get('inpatientLimit', 0):,.0f}")
                        self.logger.info(f"  Outpatient Limit: AED {plan.get('outpatientLimit', 0):,.0f}")
                        
                        # Log text field lengths for quality check
                        if "lobSpecificData" in plan:
                            lob_data = plan["lobSpecificData"]
                            if "alternativeMedicine" in lob_data:
                                alt_desc = lob_data["alternativeMedicine"].get("description", "")
                                self.logger.debug(f"  Alternative Medicine text length: {len(alt_desc)} chars")
                            if "claimsSettlementBasis" in lob_data:
                                claims_desc = lob_data["claimsSettlementBasis"].get("description", "")
                                self.logger.debug(f"  Claims Settlement text length: {len(claims_desc)} chars")
                            if "physiotherapy" in lob_data:
                                physio = lob_data["physiotherapy"]
                                self.logger.debug(f"  Physiotherapy text length: {len(physio)} chars")
                        
                        structured_plans.append(plan)
                    except Exception as e:
                        self.logger.error(f"  ❌ JSON parse error: {e}")
                        import traceback
                        self.logger.error(f"  Traceback: {traceback.format_exc()}")
                else:
                    self.logger.warning(f"  ⚠️ No JSON data captured for this plan")
                    # Log more details for debugging
                    self.logger.warning(f"  json_captured={json_captured}, json_data type={type(json_data)}")
                    if json_data:
                        self.logger.warning(f"  json_data preview: {str(json_data)[:200]}")
                
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
        COMPREHENSIVE PDF CAPTURE - tries multiple methods:
        1. Network interception for PDF responses
        2. Playwright download event
        3. New page/tab detection
        4. iframe detection
        Returns the path to the downloaded PDF file, or None if all methods fail.
        """
        try:
            # Construct filename
            import time
            filename = f"plan_{index}_{int(time.time())}.pdf"
            filepath = os.path.join(self.download_dir, filename)
            
            # Track success across all methods
            pdf_downloaded = False
            downloaded_path = None
            
            # METHOD 1: Network Request Interception (most reliable for embedded PDFs)
            captured_pdf_data = None
            
            async def handle_response(response):
                nonlocal captured_pdf_data
                try:
                    content_type = response.headers.get('content-type', '')
                    if 'application/pdf' in content_type:
                        self.logger.info(f"  📥 Intercepted PDF response: {response.url[:80]}")
                        # Get the PDF bytes
                        pdf_bytes = await response.body()
                        if len(pdf_bytes) > 1000:  # Valid PDF
                            captured_pdf_data = pdf_bytes
                            self.logger.info(f"  ✅ Captured PDF from network: {len(pdf_bytes)} bytes")
                except Exception as e:
                    self.logger.debug(f"  Response interception error: {e}")
            
            # Register network response handler
            self.page.on("response", handle_response)
            
            # METHOD 2: Download event handler
            async def handle_download(download):
                nonlocal pdf_downloaded, downloaded_path
                try:
                    self.logger.info(f"  📥 Download event: {download.suggested_filename}")
                    await download.save_as(filepath)
                    pdf_downloaded = True
                    downloaded_path = filepath
                    self.logger.info(f"  ✅ PDF downloaded via event: {os.path.getsize(filepath)} bytes")
                except Exception as e:
                    self.logger.debug(f"  Download event error: {e}")
            
            self.page.on("download", handle_download)
            
            # METHOD 3: New page handler (for popups)
            new_page_detected = False
            new_page_obj = None
            
            async def handle_new_page(page):
                nonlocal new_page_detected, new_page_obj
                new_page_detected = True
                new_page_obj = page
                self.logger.info(f"  🪟 New page opened: {page.url[:80] if page.url else 'about:blank'}")
            
            self.page.context.on("page", handle_new_page)
            
            try:
                self.logger.info(f"  🔘 Clicking download button for plan {index+1}...")
                
                # Scroll and click
                await download_button.scroll_into_view_if_needed()
                await asyncio.sleep(0.3)
                await download_button.click(force=True, timeout=5000)
                
                # Wait for PDF to be captured (optimized: 8 seconds)
                self.logger.info(f"  ⏳ Waiting for PDF capture (network/download/popup)...")
                for i in range(16):  # 16 × 0.5s = 8s (optimized for speed)
                    if captured_pdf_data or pdf_downloaded or new_page_detected:
                        self.logger.info(f"  ✅ PDF detected after {i * 0.5:.1f}s")
                        break
                    await asyncio.sleep(0.5)
                
                # Clean up handlers
                try:
                    self.page.remove_listener("response", handle_response)
                    self.page.remove_listener("download", handle_download)
                    self.page.context.remove_listener("page", handle_new_page)
                except:
                    pass
                
                # METHOD 1 SUCCESS: Save captured network PDF
                if captured_pdf_data and len(captured_pdf_data) > 1000:
                    with open(filepath, 'wb') as f:
                        f.write(captured_pdf_data)
                    self.logger.info(f"  ✅ PDF saved from network: {os.path.basename(filepath)} ({len(captured_pdf_data)} bytes)")
                    return filepath
                
                # METHOD 2 SUCCESS: Download event
                if pdf_downloaded and downloaded_path and os.path.exists(downloaded_path):
                    file_size = os.path.getsize(downloaded_path)
                    if file_size > 1000:
                        self.logger.info(f"  ✅ PDF saved from download event: {os.path.basename(downloaded_path)} ({file_size} bytes)")
                        return downloaded_path
                
                # METHOD 3: Try to extract from new page
                if new_page_detected and new_page_obj:
                    try:
                        self.logger.info(f"  🔍 Checking new page for PDF content...")
                        await asyncio.sleep(1)  # Wait for page to load
                        
                        # Check if it's a PDF viewer page
                        page_url = new_page_obj.url
                        if page_url and page_url != 'about:blank':
                            # Try to get PDF from the page
                            try:
                                # Navigate to URL and get content
                                response = await new_page_obj.goto(page_url, wait_until='domcontentloaded', timeout=5000)
                                if response:
                                    pdf_bytes = await response.body()
                                    if len(pdf_bytes) > 1000:
                                        with open(filepath, 'wb') as f:
                                            f.write(pdf_bytes)
                                        self.logger.info(f"  ✅ PDF extracted from new page: {len(pdf_bytes)} bytes")
                                        await new_page_obj.close()
                                        return filepath
                            except:
                                pass
                        
                        # Close the popup
                        await new_page_obj.close()
                    except Exception as page_err:
                        self.logger.debug(f"  New page extraction failed: {page_err}")
                
                # METHOD 4: Check for iframes
                try:
                    self.logger.info(f"  🔍 Checking for PDF in iframes...")
                    iframes = self.page.frames
                    for iframe in iframes:
                        try:
                            iframe_url = iframe.url
                            if iframe_url and 'pdf' in iframe_url.lower():
                                self.logger.info(f"  📄 Found PDF iframe: {iframe_url[:80]}")
                                # Try to navigate to it and get content
                                # Note: This might not work for blob: URLs
                                pass
                        except:
                            continue
                except Exception as iframe_err:
                    self.logger.debug(f"  iframe check failed: {iframe_err}")
                
                # FINAL FALLBACK: Poll filesystem for auto-downloaded file
                # Browser may download asynchronously - wait up to 3 more seconds
                self.logger.info(f"  ⏳ Polling filesystem for auto-downloaded PDF...")
                try:
                    for poll_attempt in range(6):  # 6 × 0.5s = 3s (optimized)
                        if os.path.exists(filepath) and os.path.getsize(filepath) > 1000:
                            file_size = os.path.getsize(filepath)
                            self.logger.info(f"  ✅ PDF found on filesystem (browser auto-download after {poll_attempt * 0.5:.1f}s): {file_size} bytes")
                            return filepath
                        await asyncio.sleep(0.5)
                    
                    # Final check
                    if os.path.exists(filepath) and os.path.getsize(filepath) > 1000:
                        file_size = os.path.getsize(filepath)
                        self.logger.info(f"  ✅ PDF found on filesystem (browser auto-download): {file_size} bytes")
                        return filepath
                except Exception as fs_check_err:
                    self.logger.debug(f"  Filesystem check error: {fs_check_err}")
                
                # All methods failed
                self.logger.warning(f"  ❌ All PDF capture methods failed for plan {index+1}")
                return None
                
            except Exception as e:
                self.logger.warning(f"  ⚠️ PDF capture error: {e}")
                import traceback
                self.logger.debug(f"  Traceback: {traceback.format_exc()}")
                # Clean up handlers
                try:
                    self.page.remove_listener("response", handle_response)
                    self.page.remove_listener("download", handle_download)
                    self.page.context.remove_listener("page", handle_new_page)
                except:
                    pass
                return None
            
        except Exception as e:
            self.logger.error(f"  ❌ Critical error in PDF download: {e}")
            import traceback
            self.logger.debug(f"  Traceback: {traceback.format_exc()}")
            return None
