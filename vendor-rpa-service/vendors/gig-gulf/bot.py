"""
GIG Gulf Insurance Portal Bot
Specialized bot for GIG Gulf Insurance portal automation
"""
import asyncio
from typing import Optional, Dict, Any
from playwright.async_api import Page
from vendors.base.vendor_bot import InsuranceBot
from vendors.base.utils import setup_logging, save_screenshot


class GigGulfBot(InsuranceBot):
    """
    Specialized bot for GIG Gulf Insurance portal
    Handles GIG Gulf-specific login flow and form navigation
    """
    
    def __init__(self, credentials: Dict[str, Any], config: Optional[Dict[str, Any]] = None):
        """
        Initialize the GIG Gulf Bot
        
        Args:
            credentials: Dictionary containing GIG Gulf portal credentials
            config: Optional configuration dictionary
        """
        super().__init__(credentials, config)
        self.logger.info("GIG Gulf Bot initialized")
    
    async def login(self):
        """
        Perform login to GIG Gulf portal
        Based on the recorded bot script
        """
        self.logger.info("Attempting GIG Gulf login...")
        
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
                await save_screenshot(self.page, "giggulf_login_page")
            
            # Fill Username
            self.logger.debug("Filling Username...")
            await self.page.get_by_role("textbox", name="Username").fill(self.credentials['username'])
            
            # Small delay for stability
            await asyncio.sleep(0.5)
            
            # Fill Password
            self.logger.debug("Filling Password...")
            await self.page.get_by_role("textbox", name="Password").fill(self.credentials['password'])
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "giggulf_before_submit")
            
            # Click Login button
            self.logger.debug("Clicking Login button...")
            await self.page.get_by_role("button", name="Login").click()
            
            # Wait for navigation after login
            self.logger.debug("Waiting for successful login...")
            await self.page.wait_for_load_state("networkidle", timeout=60000)
            await asyncio.sleep(2)
            
            self.logger.info("GIG Gulf login successful")
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "giggulf_after_login")
        
        except Exception as e:
            self.logger.error(f"GIG Gulf login failed: {e}")
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "giggulf_login_error")
            raise
    
    async def fill_insurance_form(self, form_data: Dict[str, Any]):
        """
        Fill the insurance quotation form with user data
        Based on the recorded bot script
        
        Args:
            form_data: Dictionary containing form field values from adapter
        """
        self.logger.info("Starting GIG Gulf form filling process...")
        
        try:
            # Click "Add Broker Quotation" link - this opens in a new popup
            self.logger.debug("Clicking Add Broker Quotation...")
            
            # Wait for the popup to open
            async with self.page.expect_popup() as popup_info:
                await self.page.get_by_role("link", name=" Add Broker Quotation").click()
            
            # Switch to the new page/popup
            page1 = await popup_info.value
            self.logger.debug("Switched to quotation form page")
            
            # Wait for page to load
            await page1.wait_for_load_state("networkidle")
            await asyncio.sleep(1)
            
            # Select Country
            await page1.get_by_role("button", name="Select Country   ").first.click()
            await asyncio.sleep(0.3)
            await page1.get_by_role("listbox").get_by_role("option", name="United Arab Emirates").click()
            await asyncio.sleep(0.5)
            
            # Fill First Name
            await page1.locator("input[name=\"IApplicantFName\"]").fill(form_data.get('first_name', 'Guest'))
            await asyncio.sleep(0.3)
            
            # Fill Last Name
            await page1.locator("input[name=\"IApplicantLName\"]").fill(form_data.get('last_name', 'User'))
            await asyncio.sleep(0.3)
            
            # Fill Date of Birth
            dob_str = form_data.get('dob', '18/03/1998')
            await page1.locator("#MaxdateBlock").fill(dob_str)
            await asyncio.sleep(0.3)
            
            # Select Gender
            gender = form_data.get('gender', 'Male')
            await page1.get_by_role("button", name="Select Gender   ").click()
            await asyncio.sleep(0.3)
            await page1.get_by_role("listbox").get_by_role("option", name=gender, exact=True).click()
            await asyncio.sleep(0.5)
            
            # Select Marital Status
            marital_status = form_data.get('marital_status', 'Single')
            await page1.get_by_role("button", name="Select Marital Status   ").click()
            await asyncio.sleep(0.3)
            await page1.get_by_role("listbox").get_by_role("option", name=marital_status).click()
            await asyncio.sleep(0.5)
            
            # Select Nationality
            nationality = form_data.get('nationality', 'Indian')
            await page1.get_by_role("button", name="Select Nationality   ").click()
            await asyncio.sleep(0.3)
            await page1.get_by_role("listbox").get_by_role("option", name=nationality).click()
            await asyncio.sleep(0.5)
            
            # Select State
            state = form_data.get('state', 'Abu Dhabi')
            await page1.get_by_role("button", name="Select State   ").click()
            await asyncio.sleep(0.3)
            await page1.get_by_role("listbox").get_by_role("option", name=state).click()
            await asyncio.sleep(0.5)
            
            # Select Visa Location
            visa_location = form_data.get('visa_location', 'Abu Dhabi')
            await page1.get_by_role("button", name="Select Visa Location   ").click()
            await asyncio.sleep(0.3)
            await page1.get_by_role("listbox").get_by_role("option", name=visa_location).click()
            await asyncio.sleep(0.5)
            
            # Select Country (Passport)
            passport_country = form_data.get('passport_country', 'India')
            await page1.get_by_role("button", name="Select Country   ").click()
            await asyncio.sleep(0.3)
            await page1.get_by_role("listbox").get_by_role("option", name=passport_country, exact=True).click()
            await asyncio.sleep(0.5)
            
            # Select Work Location
            work_location = form_data.get('work_location', 'BUISNESS BAY')
            await page1.get_by_role("button", name="Select Work Location   ").click()
            await asyncio.sleep(0.3)
            await page1.get_by_role("listbox").get_by_role("option", name=work_location).click()
            await asyncio.sleep(0.5)
            
            # Select Occupation
            occupation = form_data.get('occupation', 'Accountant')
            await page1.get_by_role("button", name="Select Occupation   ").click()
            await asyncio.sleep(0.3)
            await page1.get_by_role("listbox").get_by_role("option", name=occupation).click()
            await asyncio.sleep(0.5)
            
            # Fill Email
            email = form_data.get('email', 'test@gmail.com')
            await page1.get_by_role("textbox", name="john@gmail.com").fill(email)
            await asyncio.sleep(0.3)
            
            # Select Salary Range
            salary_range = form_data.get('salary_range', '>4000 and <=12000 AED/month')
            await page1.get_by_role("button", name="Select   ").click()
            await asyncio.sleep(0.3)
            await page1.get_by_role("listbox").get_by_role("option", name=salary_range).click()
            await asyncio.sleep(0.5)
            
            # Fill number of dependents (if spinbutton exists)
            try:
                await page1.get_by_role("spinbutton").fill("0")
                await asyncio.sleep(0.3)
            except:
                self.logger.debug("Spinbutton not found, skipping...")
            
            # Select Visa Type
            visa_type = form_data.get('visa_type', 'Resident visa')
            await page1.get_by_role("button", name="Select Visa Type   ").click()
            await asyncio.sleep(0.3)
            await page1.get_by_role("listbox").get_by_role("option", name=visa_type).click()
            await asyncio.sleep(0.5)
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(page1, "giggulf_form_filled")
            
            # Click Next button to proceed to plans
            self.logger.debug("Clicking Next button...")
            await page1.get_by_role("link", name="Next").click()
            
            # Wait for plans to load
            self.logger.debug("Waiting for plans to load...")
            await page1.wait_for_load_state("networkidle")
            await asyncio.sleep(3)  # Grace period for UI rendering
            
            # Store the new page reference so scraper can use it
            self.page = page1
            
            self.logger.info("Form filled successfully and plans should be loading...")
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(page1, "giggulf_plans_loaded")
        
        except Exception as e:
            self.logger.error(f"Failed to fill form: {e}")
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "giggulf_form_error")
            raise
