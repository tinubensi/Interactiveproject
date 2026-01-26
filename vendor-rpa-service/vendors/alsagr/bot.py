"""
Alsagr Insurance Portal Bot
Specialized bot for Alsagr Insurance portal automation
"""
import asyncio
from typing import Optional, Dict, Any
from playwright.async_api import Page
from vendors.base.vendor_bot import InsuranceBot
from vendors.base.utils import setup_logging, save_screenshot


class AlsagrBot(InsuranceBot):
    """
    Specialized bot for Alsagr Insurance portal
    Handles Alsagr-specific login flow and form navigation
    """
    
    def __init__(self, credentials: Dict[str, Any], config: Optional[Dict[str, Any]] = None):
        """
        Initialize the Alsagr Bot
        
        Args:
            credentials: Dictionary containing Alsagr portal credentials
            config: Optional configuration dictionary
        """
        super().__init__(credentials, config)
        self.logger.info("Alsagr Bot initialized")
    
    async def login(self):
        """
        Perform login to Alsagr portal
        Based on browser_actions.py lines 26-31
        """
        self.logger.info("Attempting Alsagr login...")
        
        try:
            # Get login URL from config
            login_url = self.config.get('portalUrl')
            
            if not login_url:
                raise ValueError("Login URL not found in config")
            
            self.logger.info(f"Navigating to login page: {login_url}")
            await self.page.goto(login_url, wait_until='networkidle')
            
            # Wait for login form to be visible
            await self.page.wait_for_selector('input', timeout=10000)
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "alsagr_login_page")
            
            # Fill Username
            self.logger.debug("Filling Username...")
            await self.page.get_by_role("textbox", name="User name").fill(self.credentials['username'])
            
            # Small delay for stability
            await asyncio.sleep(0.5)
            
            # Fill Password
            self.logger.debug("Filling Password...")
            await self.page.get_by_role("textbox", name="Password").fill(self.credentials['password'])
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "alsagr_before_submit")
            
            # Click Log In button
            self.logger.debug("Clicking Log In button...")
            await self.page.get_by_role("button", name="Log In", exact=True).click()
            
            # Wait for navigation after login (redirect to quotationsearch)
            self.logger.debug("Waiting for redirect to quotation search...")
            await self.page.wait_for_url("**/quotationsearch", timeout=60000)
            
            # CRITICAL FIX: Explicit navigation if not already there (matching working script lines 37-38)
            current_url = self.page.url
            self.logger.debug(f"After login URL: {current_url}")
            
            if current_url != "https://miportal.alsagrins.ae/quotationsearch":
                self.logger.debug("Explicitly navigating to quotation search page...")
                await self.page.goto("https://miportal.alsagrins.ae/quotationsearch", wait_until='networkidle')
                await asyncio.sleep(1)  # Wait for page to stabilize
            
            self.logger.info("Alsagr login successful")
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "alsagr_after_login")
        
        except Exception as e:
            self.logger.error(f"Alsagr login failed: {e}")
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "alsagr_login_error")
            raise
    
    async def fill_insurance_form(self, form_data: Dict[str, Any]):
        """
        Fill the insurance quotation form with user data
        Based on browser_actions.py lines 41-56
        
        Args:
            form_data: Dictionary containing form field values from adapter
        """
        self.logger.info("Starting Alsagr form filling process...")
        
        try:
            # Explicitly navigate to the quotation search page to ensure it's fully loaded
            # (matching original browser_actions.py lines 37-38)
            search_url = self.config.get('searchUrl', 'https://miportal.alsagrins.ae/quotationsearch')
            self.logger.debug(f"Ensuring we're on search page: {search_url}")
            
            if self.page.url != search_url:
                self.logger.debug(f"Navigating to search page explicitly...")
                await self.page.goto(search_url, wait_until='networkidle')
                await asyncio.sleep(1)  # Extra wait for page to stabilize
            else:
                self.logger.debug("Already on search page, waiting for stability...")
                await self.page.wait_for_load_state('networkidle')
                await asyncio.sleep(1)
            
            # Click "Generate Quick Quotation" button - try multiple variations
            # (Working script has special character, try multiple methods)
            self.logger.debug("Clicking Generate Quick Quotation button...")
            try:
                # Try with leading space (matching working script line 41)
                await self.page.get_by_role("button", name=" Generate Quick Quotation").click()
            except Exception as e1:
                try:
                    # Try without leading space
                    self.logger.debug("  Retry without leading space...")
                    await self.page.get_by_role("button", name="Generate Quick Quotation").click()
                except Exception as e2:
                    # Try with text locator as fallback
                    self.logger.debug("  Retry with text locator...")
                    await self.page.locator("button:has-text('Generate Quick Quotation')").click()
            await asyncio.sleep(1)
            
            # Fill form fields
            self.logger.debug("Filling form fields...")
            
            # Visa Emirate dropdown
            await self.page.locator("#visaEmirate").select_option(form_data.get('visaEmirate', '13'))
            await asyncio.sleep(0.3)
            
            # Salary Band dropdown
            await self.page.locator("#salaryBandTypeId").select_option(form_data.get('salaryBand', '23'))
            await asyncio.sleep(0.3)
            
            # Extract primary member data
            primary = form_data.get('primary', form_data)  # Fallback to root if no 'primary' key
            dependents = form_data.get('dependents', [])
            
            # Fill primary member fields
            self.logger.debug(f"Filling primary member: {primary.get('firstName', 'Unknown')}")
            await self.page.get_by_role("textbox", name="First Name").fill(primary.get('firstName', primary.get('first_name', 'Guest')))
            await asyncio.sleep(0.2)
            
            await self.page.get_by_role("textbox", name="Last Name").fill(primary.get('lastName', primary.get('last_name', 'User')))
            await asyncio.sleep(0.2)
            
            # Date of Birth
            await self.page.locator("#dateOfBirth").fill(primary.get('dateOfBirth', primary.get('dob', '2000-01-01')))
            await asyncio.sleep(0.3)
            
            # Gender dropdown
            await self.page.locator("#gender").select_option(primary.get('gender', '190'))
            await asyncio.sleep(0.3)
            
            # Marital Status dropdown - with fallback for portal changes
            marital_status_value = primary.get('maritalStatus', '21')
            try:
                await self.page.locator("#maritalStatus").select_option(marital_status_value, timeout=5000)
                self.logger.debug(f"Selected maritalStatus by value: {marital_status_value}")
            except Exception as e:
                self.logger.warning(f"Could not select maritalStatus by value, trying by label: {e}")
                try:
                    # Try selecting by visible text
                    marital_text = "Married" if marital_status_value == '20' else "Single"
                    await self.page.locator("#maritalStatus").select_option(label=marital_text, timeout=5000)
                    self.logger.debug(f"Selected maritalStatus by label: {marital_text}")
                except Exception as e2:
                    self.logger.error(f"Could not select maritalStatus at all, continuing anyway: {e2}")
            await asyncio.sleep(0.3)
            
            # Phone number
            await self.page.get_by_role("textbox", name="05X-XXXXXXX / 0X-XXXXXXX").fill(primary.get('phone', '0502503969'))
            await asyncio.sleep(0.2)
            
            # Email
            await self.page.get_by_role("textbox", name="Enter Email").fill(primary.get('email', 'demo@gmail.com'))
            await asyncio.sleep(0.3)
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "alsagr_form_filled")
            
            # Handle dependents (multi-member support)
            if len(dependents) > 0:
                self.logger.info(f"Adding {len(dependents)} dependent(s)...")
                
                # Click "No" to reveal additional member fields
                self.logger.debug("Clicking 'No' button to reveal dependent fields...")
                await self.page.get_by_role("button", name="No").click()
                await asyncio.sleep(1)
                
                for idx, dependent in enumerate(dependents, start=1):
                    self.logger.debug(f"Filling dependent #{idx}: {dependent.get('firstName', 'Unknown')}")
                    
                    # Fill dependent fields using indexed pattern
                    await self.page.locator(f"#memberFirstName{idx}").fill(dependent.get('firstName', ''))
                    await asyncio.sleep(0.2)
                    
                    await self.page.locator(f"#memberLastName{idx}").fill(dependent.get('lastName', ''))
                    await asyncio.sleep(0.2)
                    
                    await self.page.locator(f"#memberDateOfBirth{idx}").fill(dependent.get('dateOfBirth', ''))
                    await asyncio.sleep(0.3)
                    
                    await self.page.locator(f"#relation{idx}").select_option(dependent.get('relationshipCode', '49'))
                    await asyncio.sleep(0.3)
                    
                    await self.page.locator(f"#memberGender{idx}").select_option(dependent.get('genderCode', '190'))
                    await asyncio.sleep(0.3)
                    
                    await self.page.locator(f"#memberMaritalStatus{idx}").select_option(dependent.get('maritalStatusCode', '21'))
                    await asyncio.sleep(0.3)
                    
                    # If not the last dependent, click "Add New Member"
                    if idx < len(dependents):
                        self.logger.debug(f"Clicking 'Add New Member' for next dependent...")
                        await self.page.get_by_title("Add New Member").click()
                        await asyncio.sleep(1)
            else:
                # Single member - click "Yes"
                self.logger.debug("Single member - clicking 'Yes' button...")
                await self.page.get_by_role("button", name="Yes").click()
                await asyncio.sleep(0.5)
            
            # Click "Show Plans" button
            self.logger.info("🔘 Clicking Show Plans button...")
            await self.page.get_by_role("button", name="Show Plans").click()
            
            # Wait for plans to load
            self.logger.info("⏳ Waiting for page to load after Show Plans...")
            await self.page.wait_for_load_state("networkidle", timeout=30000)
            await asyncio.sleep(3)
            
            # CRITICAL: Check if we're still on form page or moved to plans page
            current_url_after = self.page.url
            self.logger.info(f"📍 URL after Show Plans: {current_url_after}")
            
            # Check for validation errors or alert messages
            error_selectors = [
                ".alert-danger",
                ".text-danger", 
                ".error-message",
                ".validation-error",
                "[class*='error']",
                "[class*='alert']"
            ]
            
            for selector in error_selectors:
                error_elements = await self.page.locator(selector).all()
                if len(error_elements) > 0:
                    for elem in error_elements:
                        try:
                            error_text = await elem.inner_text(timeout=1000)
                            if error_text.strip():
                                self.logger.error(f"🚨 VALIDATION ERROR: {error_text.strip()}")
                        except:
                            pass
            
            # If still on form page, log all visible text to debug
            if "indicativequote" in current_url_after:
                self.logger.error("⚠️ STILL ON FORM PAGE - Form did not submit!")
                try:
                    page_text = await self.page.locator("body").inner_text()
                    self.logger.error(f"📄 Full page text:\n{page_text[:1000]}")
                except:
                    pass
            
            # CRITICAL: Verify we're on the plans page and check what's visible
            current_url = self.page.url
            self.logger.info(f"After Show Plans - Current URL: {current_url}")
            
            # Check if planType dropdown exists (indicates we're on plans page)
            plantype_exists = await self.page.locator("#planType").count() > 0
            self.logger.info(f"Plan type dropdown exists: {plantype_exists}")
            
            # Check for any buttons/links that might be plan-related
            all_clickables = await self.page.locator("button, a").count()
            self.logger.info(f"Total clickable elements on page: {all_clickables}")
            
            # Check for table (plans are usually in a table)
            table_exists = await self.page.locator("table").count() > 0
            self.logger.info(f"Table exists on page: {table_exists}")
            
            # NEW: Check for error messages or alerts
            try:
                error_selectors = [
                    ".alert-danger", ".alert-error", ".error", ".validation-error",
                    "[class*='error']", "[role='alert']", ".invalid-feedback"
                ]
                for selector in error_selectors:
                    error_count = await self.page.locator(selector).count()
                    if error_count > 0:
                        error_text = await self.page.locator(selector).first.inner_text()
                        self.logger.warning(f"⚠️ ERROR MESSAGE FOUND ({selector}): {error_text[:200]}")
            except Exception as e:
                self.logger.debug(f"No error messages found: {e}")
            
            # NEW: Log all visible text on the page (first 2000 chars) to see what's shown
            try:
                page_text = await self.page.locator("body").inner_text()
                self.logger.info(f"📄 Page visible text (first 500 chars):\n{page_text[:500]}")
            except Exception as e:
                self.logger.debug(f"Could not get page text: {e}")
            
            if not plantype_exists:
                self.logger.warning("⚠️ WARNING: Plan type dropdown not found! May not be on plans page.")
            
            self.logger.info("Form filled successfully and plans should be loading...")
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "alsagr_after_show_plans")
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "alsagr_plans_loaded")
        
        except Exception as e:
            self.logger.error(f"Failed to fill form: {e}")
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "alsagr_form_error")
            raise
