"""
Takaful Plan Scraper Module
Handles extraction of insurance plan details from Takaful portal including table parsing
"""
import asyncio
import re
import time
from typing import List, Dict, Any, Optional
from playwright.async_api import Page
from vendors.base.utils import clean_text, setup_logging
from vendors.takaful.parser import TakafulDataParser


class TakafulScraper:
    """
    Scraper class for extracting Takaful insurance plan details
    Handles transposed table parsing (columns = plans, rows = attributes)
    """
    
    def __init__(self, page: Page, config: Optional[Dict[str, Any]] = None, form_data: Optional[Dict[str, Any]] = None):
        """
        Initialize the Takaful Scraper
        
        Args:
            page: Playwright page object
            config: Optional configuration dictionary
            form_data: Optional form data for context
        """
        self.page = page
        self.config = config or {}
        self.form_data = form_data
        self.logger = setup_logging(self.config.get('log_level', 'INFO'))
        self.parser = TakafulDataParser()
    
    async def extract_all_plans(self, bot) -> List[Dict[str, Any]]:
        """
        Extract all insurance plans from the comparison modal
        
        Args:
            bot: TakafulBot instance for navigation
        
        Returns:
            List of structured plan dictionaries in StandardPlan format
        """
        self.logger.info("🚀 Starting Takaful plan extraction...")
        
        structured_plans = []
        
        try:
            # Step 1: Wait for modal to appear
            self.logger.info("⏳ Waiting for comparison modal to load...")
            try:
                await self.page.wait_for_selector("#pdfData", timeout=10000, state="visible")
                self.logger.info("✓ Modal loaded")
                await asyncio.sleep(2)  # Extra wait for content to stabilize
            except Exception as e:
                self.logger.warning(f"⚠ Modal not found: {e}")
                await asyncio.sleep(3)
            
            # Step 2: Check for "Show more" button and click it
            self.logger.info("🔍 Checking for 'Show more' button...")
            try:
                show_more_button = self.page.locator("#pdfData").get_by_text("Show more", exact=False)
                if await show_more_button.is_visible(timeout=2000):
                    self.logger.info("  Clicking 'Show more' to load all plans...")
                    await show_more_button.click()
                    await asyncio.sleep(2)
                    self.logger.info("✓ All plans loaded")
            except Exception as e:
                self.logger.debug(f"  No 'Show more' button (this is normal): {e}")
            
            # Step 3: Scroll within modal to ensure all content is loaded
            self.logger.info("🔄 Scrolling within modal to load lazy content...")
            try:
                scroll_result = await self.page.evaluate("""
                    () => {
                        const modal = document.querySelector('#pdfData .modal-body');
                        if (modal) {
                            const initialHeight = modal.scrollHeight;
                            modal.scrollTo(0, modal.scrollHeight);
                            return {success: true, height: initialHeight};
                        }
                        return {success: false};
                    }
                """)
                if scroll_result.get('success'):
                    await asyncio.sleep(2)
                    self.logger.info(f"✓ Modal scrolled (height: {scroll_result.get('height')}px)")
            except Exception as e:
                self.logger.debug(f"  Could not scroll modal: {e}")
            
            # Step 4: Extract table structure - TRANSPOSED TABLE PARSING
            self.logger.info("📋 Parsing table structure (columns = plans, rows = attributes)...")
            
            # Find all table rows in the modal
            table_rows = await self.page.query_selector_all("#pdfData tr")
            
            if not table_rows:
                # Fallback: try without #pdfData prefix
                table_rows = await self.page.query_selector_all("tr.ng-star-inserted")
            
            self.logger.info(f"  Found {len(table_rows)} table rows")
            
            # Dictionary to store: {attribute_name: [plan1_value, plan2_value, ...]}
            attributes_by_column = {}
            num_plans = 0
            
            for row_idx, row in enumerate(table_rows):
                try:
                    # Get all cells in this row
                    cells = await row.query_selector_all("td")
                    
                    if len(cells) < 2:
                        # Skip rows with less than 2 cells (header row or empty)
                        continue
                    
                    # First cell is the attribute name/header
                    header_cell = cells[0]
                    header_text = await header_cell.inner_text()
                    header_text = header_text.strip()
                    
                    # Skip empty headers
                    if not header_text or len(header_text) < 2:
                        continue
                    
                    # Remaining cells are plan values
                    plan_values = []
                    for cell in cells[1:]:
                        cell_text = await cell.inner_text()
                        plan_values.append(cell_text.strip())
                    
                    # Store in our structure
                    if plan_values:
                        attributes_by_column[header_text] = plan_values
                        # Track the maximum number of plans
                        num_plans = max(num_plans, len(plan_values))
                
                except Exception as e:
                    self.logger.warning(f"  Warning: Could not parse row {row_idx}: {e}")
                    continue
            
            self.logger.info(f"✓ Parsed {len(attributes_by_column)} attributes for {num_plans} plans")
            
            # Step 5: Transpose - Convert column-based data to individual plan objects
            self.logger.info(f"🔄 Transposing data to {num_plans} individual plan objects...")
            
            raw_plans = []
            for plan_idx in range(num_plans):
                try:
                    # Build coverage_details for this plan
                    coverage_details = {}
                    
                    for attr_name, values in attributes_by_column.items():
                        if plan_idx < len(values):
                            coverage_details[attr_name] = values[plan_idx]
                    
                    # Extract key fields for top-level access
                    premium_text = coverage_details.get("Premium", "") or coverage_details.get("Price", "")
                    premium_match = re.search(r'AED\s*(\d+[,\d]*)', premium_text)
                    premium = f"AED {premium_match.group(1)} + VAT" if premium_match else premium_text or "Contact for pricing"
                    
                    # Extract plan name from various fields
                    plan_name = (
                        coverage_details.get("Plan Name", "") or
                        coverage_details.get("Plan", "") or
                        coverage_details.get("Product", "") or
                        f"Plan {plan_idx + 1}"
                    )
                    
                    # Clean plan name if it's too long
                    if len(plan_name) > 50:
                        # Try to extract just the plan type
                        name_match = re.search(
                            r'(BLUE\s*\d*|SILVER\s+(?:CLASSIC|PREMIUM|GOLD)|GOLD\s*\w*|GREEN|SILKROAD|BRONZE\s*\w*|CLASSIC)',
                            plan_name,
                            re.IGNORECASE
                        )
                        if name_match:
                            plan_name = name_match.group(1).strip()
                    
                    # Extract TPA
                    tpa = coverage_details.get("TPA", "Standard")
                    if not tpa or tpa == "Standard":
                        # Try to find TPA name in any field
                        for key, value in coverage_details.items():
                            for tpa_name in ["E-Care", "E CARE", "MedNet", "Nextcare", "NAS", "Aafiya"]:
                                if tpa_name.lower() in str(value).lower():
                                    tpa = tpa_name
                                    break
                    
                    # Extract Network
                    network = coverage_details.get("Network", "Standard Network")
                    if len(network) > 50:
                        network = network[:47] + "..."
                    
                    # Extract Co-pay
                    copay_text = coverage_details.get("Co-pay", "") or coverage_details.get("Co-pay Consultation Pharmacy Diagnostic", "")
                    copay_match = re.search(r'(\d+)\s*%', str(copay_text))
                    copay = f"{copay_match.group(1)}%" if copay_match else "N/A"
                    
                    plan_data = {
                        "plan_number": plan_idx + 1,
                        "plan_name": plan_name.strip() if plan_name else f"Plan {plan_idx + 1}",
                        "premium": premium,
                        "network": network,
                        "tpa": tpa,
                        "copay": copay,
                        "coverage_details": coverage_details
                    }
                    
                    # Try to download PDF for this plan (works for up to 70 plans)
                    try:
                        pdf_path = await self._download_plan_pdf(plan_idx, plan_name)
                        if pdf_path:
                            plan_data['pdf_path'] = pdf_path
                            self.logger.info(f"  ✓ PDF downloaded for plan {plan_idx + 1}: {plan_name}")
                        else:
                            self.logger.debug(f"  No PDF available for plan {plan_idx + 1}")
                    except Exception as e:
                        self.logger.warning(f"  ⚠️ PDF download failed for plan {plan_idx + 1}: {e}")
                    
                    raw_plans.append(plan_data)
                    
                except Exception as e:
                    self.logger.warning(f"  Warning: Could not build plan {plan_idx + 1}: {e}")
                    continue
            
            self.logger.info(f"✅ Successfully extracted {len(raw_plans)} raw plan(s)")
            
            # Step 6: Parse raw plans to StandardPlan format
            self.logger.info("🔄 Parsing plans to StandardPlan format...")
            for raw_plan in raw_plans:
                try:
                    structured_plan = self.parser.parse_plan(raw_plan, self.form_data)
                    structured_plans.append(structured_plan)
                except Exception as e:
                    self.logger.error(f"Failed to parse plan {raw_plan.get('plan_name')}: {e}")
            
            self.logger.info(f"✅ Successfully parsed {len(structured_plans)} plans to StandardPlan format")
            
        except Exception as e:
            self.logger.error(f"❌ Failed to extract plans: {e}", exc_info=True)
        
        return structured_plans
    
    async def _download_plan_pdf(self, plan_idx: int, plan_name: str = None) -> Optional[str]:
        """
        Downloads the plan PDF for a specific plan index.
        Uses Alsagr's download event method (works in headless mode).
        Supports up to 70 plans.
        
        Args:
            plan_idx: Zero-based index of the plan (column index in table)
            plan_name: Optional plan name for logging
        
        Returns:
            Path to downloaded PDF file, or None if download fails
        """
        try:
            import time
            import os
            
            filename = f"takaful_plan_{plan_idx + 1}_{int(time.time())}.pdf"
            download_dir = "/tmp/takaful_downloads"
            os.makedirs(download_dir, exist_ok=True)
            try:
                os.chmod(download_dir, 0o777)
            except:
                pass
            filepath = os.path.join(download_dir, filename)
            
            # Find the row with plan-details-link (flexible - might not always be row 14)
            plan_details_row = None
            row_index = None
            
            # Strategy: Find row by looking for .plan-details-link in any row
            try:
                # Try row 14 first (common case from script)
                row_14 = await self.page.query_selector("#pdfData tr:nth-child(14)")
                if row_14:
                    link = await row_14.query_selector(f"td:nth-child({plan_idx + 2}) > .plan-details-link")
                    if link:
                        plan_details_row = row_14
                        row_index = 14
                        self.logger.info(f"  ✓ Found plan details row at index 14")
            except:
                pass
            
            # If row 14 doesn't work, search all rows
            if not plan_details_row:
                try:
                    all_rows = await self.page.query_selector_all("#pdfData tr")
                    for idx, row in enumerate(all_rows, start=1):
                        link = await row.query_selector(f"td:nth-child({plan_idx + 2}) > .plan-details-link")
                        if link:
                            plan_details_row = row
                            row_index = idx
                            self.logger.info(f"  ✓ Found plan details row at index {idx}")
                            break
                except Exception as e:
                    self.logger.debug(f"  Could not find plan details row: {e}")
            
            if not plan_details_row:
                self.logger.warning(f"  ⚠️ No plan details row found for plan {plan_idx + 1}")
                return None
            
            # Build selector for the specific plan link
            column_index = plan_idx + 2
            selector = f"#pdfData tr:nth-child({row_index}) > td:nth-child({column_index}) > .plan-details-link"
            
            download_button = await self.page.query_selector(selector)
            
            if not download_button:
                self.logger.warning(f"  ⚠️ No PDF download link found for plan {plan_idx + 1} at {selector}")
                return None
            
            # Check if visible
            is_visible = await download_button.is_visible()
            if not is_visible:
                self.logger.warning(f"  ⚠️ PDF download link not visible for plan {plan_idx + 1}")
                return None
            
            self.logger.info(f"  ✓ Found PDF download link for plan {plan_idx + 1}")
            
            # Strategy 1: Use download event handler (Alsagr method - works in headless mode)
            pdf_downloaded = False
            downloaded_path = None
            
            async def handle_download(download):
                nonlocal pdf_downloaded, downloaded_path
                try:
                    self.logger.info(f"  📥 Download event triggered for plan {plan_idx + 1}")
                    # Try to get suggested filename (might be property or method)
                    try:
                        if hasattr(download, 'suggested_filename'):
                            if callable(download.suggested_filename):
                                suggested_filename = download.suggested_filename()
                            else:
                                suggested_filename = download.suggested_filename
                            self.logger.info(f"  📄 Suggested filename: {suggested_filename}")
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
                    import traceback
                    self.logger.debug(f"  Download handler traceback:\n{traceback.format_exc()}")
            
            # Register download handler BEFORE clicking
            self.page.on("download", handle_download)
            
            try:
                self.logger.info(f"  🔘 Clicking plan details link for plan {plan_idx + 1} (Strategy 1: Download Event)...")
                
                # Click the download button
                await download_button.click()
                
                # Wait for download to complete (max 15 seconds)
                self.logger.debug(f"  Waiting for download event (max 15s)...")
                for i in range(30):  # 30 × 0.5s = 15s max
                    if pdf_downloaded:
                        self.logger.info(f"  ✅ Download detected after {i * 0.5:.1f}s")
                        break
                    await asyncio.sleep(0.5)
                
                # Remove download handler
                self.page.remove_listener("download", handle_download)
                
                if pdf_downloaded and downloaded_path:
                    return downloaded_path
                else:
                    self.logger.debug(f"  ⚠️ Download event did not fire after clicking")
                    
            except Exception as e:
                self.logger.warning(f"  Download event approach failed: {e}")
                # Remove handler on error
                try:
                    self.page.remove_listener("download", handle_download)
                except:
                    pass
            
            # Strategy 2: Try popup approach (fallback for non-headless or if download event doesn't fire)
            try:
                self.logger.debug("  Trying popup approach...")
                async with self.page.expect_popup(timeout=5000) as popup_info:
                    await download_button.click()
                
                popup_page = await popup_info.value
                await popup_page.wait_for_load_state("networkidle", timeout=10000)
                
                # Check if popup URL is a PDF
                popup_url = popup_page.url
                content_type = await popup_page.evaluate("() => document.contentType || ''")
                
                if popup_url.endswith(".pdf") or "application/pdf" in content_type:
                    # Download PDF from popup URL
                    try:
                        response = await popup_page.request.fetch(popup_url)
                        body = await response.body()
                        if body.startswith(b'%PDF'):
                            with open(filepath, "wb") as f:
                                f.write(body)
                            await popup_page.close()
                            self.logger.info(f"  ✅ PDF downloaded from popup URL: {len(body)} bytes")
                            return filepath
                    except Exception as e:
                        self.logger.debug(f"  Failed to fetch from popup URL: {e}")
                
                # Strategy 3: If popup is HTML, try to generate PDF from it
                try:
                    await popup_page.pdf(path=filepath, format='A4')
                    await popup_page.close()
                    if os.path.exists(filepath) and os.path.getsize(filepath) > 1000:
                        self.logger.info(f"  ✅ PDF generated from popup content")
                        return filepath
                except Exception as e:
                    self.logger.debug(f"  Failed to generate PDF from popup: {e}")
                    try:
                        await popup_page.close()
                    except:
                        pass
                        
            except Exception as e:
                self.logger.debug(f"  Popup approach failed: {e}")
            
            # Strategy 4: Intercept network requests for PDF
            try:
                self.logger.debug("  Trying network interception...")
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
                await asyncio.sleep(3)  # Wait for network request
                
                # Remove handler
                self.page.remove_listener("response", handle_response)
                
                if pdf_body and pdf_body.startswith(b'%PDF'):
                    with open(filepath, "wb") as f:
                        f.write(pdf_body)
                    self.logger.info(f"  ✅ PDF downloaded via network interception: {len(pdf_body)} bytes")
                    return filepath
                    
            except Exception as e:
                self.logger.debug(f"  Network interception failed: {e}")
            
            self.logger.warning(f"  ⚠️ All PDF download strategies failed for plan {plan_idx + 1}")
            return None
            
        except Exception as e:
            self.logger.warning(f"  ⚠️ Failed to download PDF for plan {plan_idx + 1}: {e}")
            import traceback
            self.logger.debug(f"  Traceback: {traceback.format_exc()}")
            return None







