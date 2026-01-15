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
            
            # Name fields
            await self.page.get_by_role("textbox", name="First Name").fill(form_data.get('first_name', 'Guest'))
            await asyncio.sleep(0.2)
            
            await self.page.get_by_role("textbox", name="Last Name").fill(form_data.get('last_name', 'User'))
            await asyncio.sleep(0.2)
            
            # Date of Birth
            await self.page.locator("#dateOfBirth").fill(form_data.get('dob', '2000-01-01'))
            await asyncio.sleep(0.3)
            
            # Gender dropdown
            await self.page.locator("#gender").select_option(form_data.get('gender', '190'))
            await asyncio.sleep(0.3)
            
            # Marital Status dropdown - with fallback for portal changes
            try:
                await self.page.locator("#maritalStatus").select_option(form_data.get('maritalStatus', '21'), timeout=5000)
                self.logger.debug(f"Selected maritalStatus by value: {form_data.get('maritalStatus', '21')}")
            except Exception as e:
                self.logger.warning(f"Could not select maritalStatus by value, trying by label: {e}")
                try:
                    # Try selecting by visible text
                    marital_text = "Married" if form_data.get('maritalStatus') == '22' else "Single"
                    await self.page.locator("#maritalStatus").select_option(label=marital_text, timeout=5000)
                    self.logger.debug(f"Selected maritalStatus by label: {marital_text}")
                except Exception as e2:
                    self.logger.error(f"Could not select maritalStatus at all, continuing anyway: {e2}")
                    # Continue without failing - portal might work without this field
            await asyncio.sleep(0.3)
            
            # Phone number
            await self.page.get_by_role("textbox", name="05X-XXXXXXX / 0X-XXXXXXX").fill(form_data.get('phone', '0502503969'))
            await asyncio.sleep(0.2)
            
            # Email
            await self.page.get_by_role("textbox", name="Enter Email").fill(form_data.get('email', 'demo@gmail.com'))
            await asyncio.sleep(0.3)
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "alsagr_form_filled")
            
            # Click consent "Yes" button
            self.logger.debug("Clicking consent button...")
            await self.page.get_by_role("button", name="Yes").click()
            await asyncio.sleep(0.5)
            
            # Click "Show Plans" button
            self.logger.debug("Clicking Show Plans button...")
            await self.page.get_by_role("button", name="Show Plans").click()
            
            # Wait for plans to load - EXACT timing from browser_actions.py lines 59-61
            self.logger.debug("Waiting for plans to load...")
            await self.page.wait_for_load_state("networkidle")
            await asyncio.sleep(3)  # Grace period for UI rendering (matching original)
            
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
