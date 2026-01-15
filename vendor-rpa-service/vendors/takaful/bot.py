"""
Takaful Emarat Insurance Portal Bot
Specialized bot for Takaful Emarat Insurance portal with custom login and navigation
"""
import asyncio
import re
from typing import Optional, Dict, Any
from playwright.async_api import Page
from vendors.base.vendor_bot import InsuranceBot
from vendors.base.utils import setup_logging, save_screenshot


class TakafulBot(InsuranceBot):
    """
    Specialized bot for Takaful Emarat Insurance portal
    Handles Takaful-specific login flow and multi-step form navigation
    """
    
    def __init__(self, credentials: Dict[str, Any], config: Optional[Dict[str, Any]] = None):
        """
        Initialize the Takaful Bot
        
        Args:
            credentials: Dictionary containing Takaful portal credentials
            config: Optional configuration dictionary
        """
        super().__init__(credentials, config)
        self.logger.info("Takaful Bot initialized")
    
    async def login(self):
        """
        Perform login to Takaful portal using placeholder selectors
        """
        self.logger.info("Attempting Takaful login...")
        
        try:
            # FIXED: Get login URL from config, not credentials
            login_url = self.config.get('authUrl') or self.config.get('portalUrl')
            
            if not login_url:
                raise ValueError("Login URL not found in config")
            
            self.logger.info(f"Navigating to login page: {login_url}")
            await self.page.goto(login_url, wait_until='networkidle')
            
            # Wait for login form to be visible
            await self.page.wait_for_selector('input', timeout=10000)
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "takaful_login_page")
            
            # Fill Username using placeholder selector
            self.logger.debug("Filling Username...")
            await self.page.get_by_placeholder("Username").fill(self.credentials['username'])
            
            # Small delay for better stability
            await asyncio.sleep(0.5)
            
            # Fill Password using placeholder selector
            self.logger.debug("Filling Password...")
            await self.page.get_by_placeholder("Password").fill(self.credentials['password'])
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "takaful_before_submit")
            
            # Click Sign In button
            self.logger.debug("Clicking Sign In button...")
            await self.page.get_by_role("button", name="Sign In").click()
            
            # Wait for navigation after login
            await self.page.wait_for_load_state('domcontentloaded', timeout=30000)
            
            # Wait briefly for redirects
            await asyncio.sleep(2)
            
            # Check if login was successful
            current_url = self.page.url
            self.logger.debug(f"After login URL: {current_url}")
            
            if 'login' in current_url.lower():
                # Still on login page - check for error message
                page_text = await self.page.locator('body').inner_text()
                if 'does not exist' in page_text.lower():
                    raise ValueError("Login failed: User does not exist - credentials are incorrect")
                elif 'invalid' in page_text.lower() or 'incorrect' in page_text.lower():
                    raise ValueError("Login failed: Invalid username or password")
                else:
                    raise ValueError("Login failed: Still on login page after submission")
            
            self.logger.info("Takaful login successful")
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "takaful_after_login")
        
        except Exception as e:
            self.logger.error(f"Takaful login failed: {e}")
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "takaful_login_error")
            raise
    
    async def fill_insurance_form(self, form_data: Dict[str, Any]):
        """
        Fill the multi-step insurance form with user data
        
        Args:
            form_data: Dictionary containing form field values
        """
        self.logger.info("Starting form filling process...")
        
        try:
            # Step 1: Start new application
            self.logger.debug("Starting new Health+ application...")
            await self.page.locator("div").filter(has_text=re.compile(r"^New Health\+ Application$")).nth(1).click()
            await self.page.wait_for_load_state("domcontentloaded")
            await asyncio.sleep(1)
            
            # Step 2: Select emirate
            emirate = form_data.get('emirate', 'Dubai')
            self.logger.debug(f"Selecting emirate: {emirate}")
            await self.page.locator(".control__indicator").first.click()
            await asyncio.sleep(0.3)
            await self.page.get_by_text(emirate).click()
            await asyncio.sleep(0.5)
            
            # Step 3: Fill personal details
            self.logger.debug("Filling personal details...")
            
            # Name fields
            first_name = form_data.get('first_name', 'Customer')
            family_name = form_data.get('family_name', 'User')
            
            await self.page.locator("input[name='first_name']").fill(first_name)
            await self.page.locator("input[name='family_name']").fill(family_name)
            
            # Date of birth
            dob = form_data.get('dob', {})
            if dob:
                await self.page.get_by_placeholder("DD/MM/YYYY").click()
                await asyncio.sleep(0.3)
                await self.page.get_by_label("Select year").select_option(str(dob.get("year", "1990")))
                await asyncio.sleep(0.2)
                await self.page.get_by_label("Select month").select_option(str(dob.get("month", "5")))
                await asyncio.sleep(0.5)  # Wait for calendar to update after month selection
                # Click the first matching day (in the selected month)
                await self.page.get_by_text(str(dob.get("day", "10")), exact=True).first.click()
                await asyncio.sleep(0.3)
            
            # Gender and marital status
            gender = form_data.get('gender', 'Male')
            marital_status = form_data.get('marital_status', 'Single')
            
            await self.page.get_by_text(gender, exact=True).click()
            await asyncio.sleep(0.3)
            await self.page.get_by_text(marital_status).click()
            await asyncio.sleep(0.3)
            
            # Step 4: Fill contact details
            self.logger.debug("Filling contact details...")
            
            email = form_data.get('email', 'customer@example.com')
            await self.page.locator("input[name='email_']").fill(email)
            
            phone = form_data.get('phone', '501234567')
            # Clean phone number (should already be cleaned by adapter)
            phone_clean = phone.replace("+", "").replace("-", "").replace(" ", "")
            if phone_clean.startswith("971"):
                phone_clean = phone_clean[3:]
            await self.page.locator("input[name='contact_no']").fill(phone_clean)
            
            # Step 5: Fill sponsor details
            self.logger.info("Filling sponsor details...")
            
            # Click sponsor checkbox
            self.logger.info("  - Clicking sponsor checkbox...")
            await self.page.locator(".ng-untouched > div > .col-12 > .form-group > .media > .control > .control__indicator").click()
            await asyncio.sleep(0.3)
            
            # Select sponsor type
            self.logger.info("  - Opening sponsor type dropdown...")
            await self.page.locator("div").filter(has_text=re.compile(r"^Sponsor Type \*$")).locator("div").nth(3).click()
            await asyncio.sleep(0.3)
            
            sponsor_type = form_data.get('sponsor_type', 'Resident')
            self.logger.info(f"  - Selecting sponsor type: {sponsor_type}")
            await self.page.get_by_text(sponsor_type, exact=True).click()
            await asyncio.sleep(0.3)
            
            # Select salary - use get_by_role for ng-select options
            salary = form_data.get('salary', 'Less than 5000')
            self.logger.info(f"  - Selecting salary: {salary}")
            
            # Click to open the salary dropdown
            self.logger.info("  - Opening salary dropdown...")
            await self.page.locator(".form-group > div > .ng-select > .ng-select-container").click()
            await asyncio.sleep(0.5)
            
            # Select the salary option using get_by_role (like other ng-select options)
            self.logger.info(f"  - Clicking salary option: {salary}")
            await self.page.get_by_role("option", name=salary).click()
            self.logger.info("  ✓ Salary selected")
            await asyncio.sleep(0.5)
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "takaful_form_filled")
            
            # Step 6: Save and proceed
            self.logger.debug("Saving and proceeding...")
            await self.page.get_by_role("button", name="Save & Proceed").click()
            await asyncio.sleep(2)
            
            # Step 7: Agree to terms
            self.logger.info("Agreeing to terms...")
            try:
                await self.page.get_by_role("button", name="I agree to the above").click(timeout=10000)
                self.logger.info("  ✓ Clicked 'I agree' button")
            except:
                # Try alternative selectors
                try:
                    await self.page.locator("button:has-text('agree')").click(timeout=5000)
                    self.logger.info("  ✓ Clicked 'agree' button (alternative)")
                except:
                    self.logger.warning("  Could not find 'I agree' button, continuing...")
            
            await self.page.wait_for_load_state("domcontentloaded")
            await asyncio.sleep(2)
            
            # Step 8: Customize plan
            self.logger.debug("Customizing plan...")
            await self.page.get_by_role("button", name="Customize plan").click()
            await asyncio.sleep(1)
            
            # Wait for Advance Search button
            try:
                await self.page.wait_for_selector("button:has-text('Advance Search')", timeout=3000)
            except:
                pass
            
            # Click advance search
            await self.page.get_by_role("button", name="Advance Search").click()
            await asyncio.sleep(1)
            
            # Apply filters using JavaScript (instant checkbox selection)
            self.logger.debug("Applying filters...")
            try:
                await self.page.wait_for_selector("button:has-text('Network')", timeout=3000)
            except:
                pass
            
            # Use JavaScript to check ALL checkboxes instantly
            await self.page.evaluate("""
                () => {
                    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
                    checkboxes.forEach(checkbox => {
                        if (!checkbox.checked) {
                            checkbox.click();
                        }
                    });
                    return checkboxes.length;
                }
            """)
            await asyncio.sleep(0.5)
            
            # Click search
            self.logger.debug("Searching for plans...")
            try:
                await self.page.wait_for_selector("button:has-text('Search')", timeout=3000)
            except:
                pass
            
            await self.page.get_by_role("button", name="Search", exact=True).click()
            
            # Wait for plans to start loading
            self.logger.debug("Waiting for plans to load...")
            try:
                await self.page.wait_for_load_state("domcontentloaded", timeout=5000)
                await asyncio.sleep(3)  # Extra wait for dynamic content
            except:
                await asyncio.sleep(3)
            
            self.logger.info("Form filled successfully and plans loaded")
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "takaful_plans_loaded")
        
        except Exception as e:
            self.logger.error(f"Failed to fill form: {e}")
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "takaful_form_error")
            raise
