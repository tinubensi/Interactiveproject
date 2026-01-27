"""
GIG Gulf Insurance Portal Bot
Specialized bot for GIG Gulf Insurance portal automation
"""
import asyncio
from typing import Optional, Dict, Any, List
from playwright.async_api import Page
from vendors.base.vendor_bot import InsuranceBot
from vendors.base.utils import setup_logging, save_screenshot


class Gig_gulfBot(InsuranceBot):
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
        Navigates to broker portal and handles authentication
        """
        self.logger.info("Attempting GIG Gulf login...")
        
        try:
            # Get portal URL from config
            portal_url = self.config.get('portalUrl')
            
            if not portal_url:
                raise ValueError("Portal URL not found in config")
            
            self.logger.info(f"Navigating to portal: {portal_url}")
            await self.page.goto(portal_url, wait_until='domcontentloaded', timeout=60000)
            
            # Wait for page to stabilize
            await asyncio.sleep(3)
            
            current_url = self.page.url
            self.logger.info(f"Current URL: {current_url}")
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "giggulf_initial_page")
            
            # Check if we're redirected to login page or if login is on the same page
            # Look for username/password fields
            self.logger.debug("Looking for login form...")
            
            # Try to find login elements with various strategies
            username_found = False
            password_found = False
            
            # Strategy 1: Try by role
            try:
                username_field = self.page.get_by_role("textbox", name="Username")
                if await username_field.count() > 0:
                    username_found = True
                    self.logger.debug("Found username field by role")
            except:
                pass
            
            # Strategy 2: Try common username selectors
            if not username_found:
                for selector in ['input[name="username"]', 'input[name="userName"]', 'input[type="text"]', 'input#username', 'input#userName']:
                    try:
                        if await self.page.locator(selector).count() > 0:
                            username_found = True
                            username_field = self.page.locator(selector).first
                            self.logger.debug(f"Found username field with selector: {selector}")
                            break
                    except:
                        continue
            
            if not username_found:
                raise Exception("Could not find username field on page")
            
            # Fill Username
            self.logger.debug("Filling Username...")
            await username_field.click()
            await username_field.fill(self.credentials['username'])
            await asyncio.sleep(0.5)
            
            # Find and fill password
            try:
                password_field = self.page.get_by_role("textbox", name="Password")
                if await password_field.count() > 0:
                    password_found = True
            except:
                pass
            
            if not password_found:
                password_field = self.page.locator('input[type="password"]').first
            
            self.logger.debug("Filling Password...")
            await password_field.click()
            await password_field.fill(self.credentials['password'])
            await asyncio.sleep(0.5)
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "giggulf_before_submit")
            
            # Find and click login button
            self.logger.debug("Clicking Login button...")
            login_button = None
            
            # Try various button selectors
            for selector in ['button:has-text("Login")', 'button:has-text("Sign In")', 'button[type="submit"]', 'input[type="submit"]']:
                try:
                    if await self.page.locator(selector).count() > 0:
                        login_button = self.page.locator(selector).first
                        break
                except:
                    continue
            
            if not login_button:
                try:
                    login_button = self.page.get_by_role("button", name="Login")
                except:
                    raise Exception("Could not find login button")
            
            await login_button.click()
            
            # Wait for navigation after login
            self.logger.debug("Waiting for successful login...")
            await self.page.wait_for_load_state("networkidle", timeout=60000)
            await asyncio.sleep(2)
            
            self.logger.info(f"Login complete. Current URL: {self.page.url}")
            
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
            # Check current URL after login
            current_url = self.page.url
            self.logger.info(f"Current URL after login: {current_url}")
            
            page1 = None
            
            # If we're not on the broker quotation index page, navigate there
            # Use case-insensitive check
            if "brokerindividualquotation/index" not in current_url.lower():
                broker_index_url = "https://health.gig-gulf.com/broker-quotation/BrokerIndividualQuotation/Index"
                self.logger.info(f"Navigating to broker index: {broker_index_url}")
                await self.page.goto(broker_index_url, wait_until='networkidle', timeout=60000)
                await asyncio.sleep(3)  # Give extra time for dynamic content to load
                
                # Verify we're on the correct page
                current_url = self.page.url
                self.logger.info(f"Current URL after navigation: {current_url}")
            
            # Look for "Add Broker Quotation" link/button
            self.logger.debug("Looking for Add Broker Quotation link...")
            
            # Wait for page to be fully loaded
            await self.page.wait_for_load_state("networkidle", timeout=30000)
            await asyncio.sleep(2)  # Additional wait for dynamic content
            
            try:
                # Try multiple strategies to find the link
                add_quote_link = None
                
                # Strategy 1: Try by role with exact name (as per recorded actions)
                try:
                    add_quote_link = self.page.get_by_role("link", name=" Add Broker Quotation")
                    if await add_quote_link.count() > 0:
                        self.logger.debug("Found link using role with exact name")
                except:
                    pass
                
                # Strategy 2: Try by role without leading space
                if not add_quote_link or await add_quote_link.count() == 0:
                    try:
                        add_quote_link = self.page.get_by_role("link", name="Add Broker Quotation")
                        if await add_quote_link.count() > 0:
                            self.logger.debug("Found link using role without leading space")
                    except:
                        pass
                
                # Strategy 3: Try text selector
                if not add_quote_link or await add_quote_link.count() == 0:
                    try:
                        await self.page.wait_for_selector('a:has-text("Add Broker Quotation")', timeout=5000, state='visible')
                        add_quote_link = self.page.locator('a:has-text("Add Broker Quotation")').first
                        self.logger.debug("Found link using text selector")
                    except:
                        pass
                
                # Strategy 4: Try partial text match
                if not add_quote_link or await add_quote_link.count() == 0:
                    try:
                        await self.page.wait_for_selector('a:has-text("Broker Quotation")', timeout=5000, state='visible')
                        # Find the one that contains "Add"
                        links = await self.page.locator('a:has-text("Broker Quotation")').all()
                        for link in links:
                            text = await link.inner_text()
                            if "Add" in text:
                                add_quote_link = link
                                self.logger.debug(f"Found link using partial text: {text}")
                                break
                    except:
                        pass
                
                # Strategy 5: Try finding any link with "Add" and "Broker" in text
                if not add_quote_link or await add_quote_link.count() == 0:
                    try:
                        all_links = await self.page.locator('a').all()
                        for link in all_links:
                            try:
                                text = await link.inner_text()
                                if "Add" in text and "Broker" in text and "Quotation" in text:
                                    add_quote_link = link
                                    self.logger.debug(f"Found link by searching all links: {text}")
                                    break
                            except:
                                continue
                    except:
                        pass
                
                if not add_quote_link or await add_quote_link.count() == 0:
                    # Log page state for debugging
                    self.logger.error("Could not find Add Broker Quotation link. Page state:")
                    self.logger.error(f"Current URL: {self.page.url}")
                    try:
                        page_title = await self.page.title()
                        self.logger.error(f"Page title: {page_title}")
                    except:
                        pass
                    try:
                        # Count links on page
                        link_count = await self.page.locator('a').count()
                        self.logger.error(f"Total links on page: {link_count}")
                        # Log first few links
                        links = await self.page.locator('a').all()
                        for i, link in enumerate(links[:10]):
                            try:
                                text = await link.inner_text()
                                self.logger.error(f"Link {i+1}: {text[:50]}")
                            except:
                                pass
                    except:
                        pass
                    raise Exception("Add Broker Quotation link not found on page")
                
                self.logger.debug("Found Add Broker Quotation link, clicking...")
                
                # Wait for the popup to open
                async with self.page.expect_popup(timeout=15000) as popup_info:
                    await add_quote_link.click()
                
                # Switch to the new page/popup (OUTSIDE async with, INSIDE try)
                page1 = await popup_info.value
                self.logger.debug(f"Switched to quotation form page: {page1.url}")
                
                # Wait for form to load
                await page1.wait_for_load_state("domcontentloaded")
                await asyncio.sleep(2)
                
            except Exception as e:
                self.logger.error(f"Could not open Add Broker Quotation popup: {e}")
                raise Exception(f"Failed to open quotation form: {e}")

            # Wait for page to load
            await page1.wait_for_load_state("networkidle")
            await asyncio.sleep(1)
            
            # Select Country
            await page1.get_by_role("button", name="Select Country   ").first.click()
            await asyncio.sleep(0.3)
            await page1.get_by_role("listbox").get_by_role("option", name="United Arab Emirates").click()
            await asyncio.sleep(0.5)
            
            # Fill First Name
            first_name = form_data.get('first_name', 'Guest')
            self.logger.debug(f"Filling First Name: {first_name}")
            await page1.locator("input[name=\"IApplicantFName\"]").click()
            await asyncio.sleep(0.2)
            await page1.locator("input[name=\"IApplicantFName\"]").fill(first_name)
            await asyncio.sleep(0.3)
            self.logger.info(f"✓ First Name filled: {first_name}")
            
            # Fill Last Name
            last_name = form_data.get('last_name', 'User')
            self.logger.debug(f"Filling Last Name: {last_name}")
            await page1.locator("input[name=\"IApplicantLName\"]").click()
            await asyncio.sleep(0.2)
            await page1.locator("input[name=\"IApplicantLName\"]").fill(last_name)
            await asyncio.sleep(0.3)
            self.logger.info(f"✓ Last Name filled: {last_name}")
            
            # Fill Effective Date (MindateBlock) - date picker
            self.logger.debug("Filling Effective Date...")
            effective_date_str = form_data.get('effective_date', '31/01/2026')
            self.logger.debug(f"Using effective date: {effective_date_str}")
            
            # Try to extract the day from the date string (DD/MM/YYYY format)
            try:
                day = effective_date_str.split('/')[0]
                month = effective_date_str.split('/')[1]
                year = effective_date_str.split('/')[2]
                self.logger.debug(f"Extracted date: day={day}, month={month}, year={year}")
            except:
                day = "31"
                month = "01"
                year = "2026"
                self.logger.warning(f"Could not parse date, using default: {day}/{month}/{year}")
            
            # Click the date picker field to open it
            await page1.locator("#MindateBlock").click()
            await asyncio.sleep(1)
            
            date_set_success = False
            
            # Strategy 1: Click the enabled date cell (not disabled ones)
            try:
                self.logger.debug(f"Looking for enabled day {day} in date picker...")
                
                # Find all cells with the day number
                day_cells = page1.get_by_role("cell", name=day, exact=True)
                cell_count = await day_cells.count()
                self.logger.debug(f"Found {cell_count} cells with day {day}")
                
                # Try each cell and click the one that's not disabled
                for i in range(cell_count):
                    try:
                        cell = day_cells.nth(i)
                        # Check if cell has 'disabled' class
                        cell_class = await cell.get_attribute('class')
                        self.logger.debug(f"Cell {i} classes: {cell_class}")
                        
                        if cell_class and 'disabled' not in cell_class and 'old' not in cell_class:
                            # This is an enabled cell from current/future month
                            await cell.click()
                            self.logger.info(f"✓ Successfully clicked enabled day {day} (cell {i})")
                            date_set_success = True
                            break
                    except Exception as e:
                        self.logger.debug(f"Could not click cell {i}: {e}")
                        continue
                
                if not date_set_success:
                    # If no enabled cell found, try the last one (usually the current month)
                    if cell_count > 0:
                        await day_cells.last.click()
                        self.logger.info(f"✓ Clicked last day {day} cell as fallback")
                        date_set_success = True
                        
            except Exception as e:
                self.logger.warning(f"Strategy 1 failed: {e}")
            
            # Strategy 2: Use direct locator with CSS selector to target non-disabled dates
            if not date_set_success:
                try:
                    self.logger.debug(f"Trying CSS selector for enabled day {day}...")
                    # Target day cells that don't have 'disabled' or 'old' classes
                    enabled_day = page1.locator(f'td.day:not(.disabled):not(.old):has-text("{day}")').first
                    await enabled_day.click(timeout=3000)
                    self.logger.info(f"✓ Successfully clicked enabled day {day} using CSS selector")
                    date_set_success = True
                except Exception as e:
                    self.logger.warning(f"Strategy 2 failed: {e}")
            
            # Strategy 3: Type the date directly
            if not date_set_success:
                try:
                    self.logger.debug(f"Trying to type date directly: {effective_date_str}")
                    # Close the date picker first
                    await page1.keyboard.press('Escape')
                    await asyncio.sleep(0.3)
                    
                    # Click the field and clear it
                    await page1.locator("#MindateBlock").click()
                    await asyncio.sleep(0.3)
                    await page1.locator("#MindateBlock").fill('')
                    await asyncio.sleep(0.3)
                    
                    # Type the date
                    await page1.locator("#MindateBlock").type(effective_date_str, delay=100)
                    await asyncio.sleep(0.5)
                    
                    # Verify the value was set
                    value = await page1.locator("#MindateBlock").input_value()
                    if value and len(value) > 0:
                        self.logger.info(f"✓ Successfully typed effective date: {value}")
                        date_set_success = True
                    else:
                        self.logger.warning("Date field appears empty after typing")
                except Exception as e:
                    self.logger.warning(f"Strategy 3 failed: {e}")
            
            if not date_set_success:
                self.logger.error(f"❌ Failed to set effective date after all strategies")
            
            await asyncio.sleep(0.5)
            
            # Fill Date of Birth (MaxdateBlock) - Use type for masked input
            dob_str = form_data.get('dob', '18/04/1998')
            self.logger.debug(f"Filling Date of Birth: {dob_str}")
            await page1.locator("#MaxdateBlock").click()
            await asyncio.sleep(0.5)
            # Clear any existing value
            await page1.locator("#MaxdateBlock").fill('')
            await asyncio.sleep(0.3)
            # Type slowly for masked input to register properly
            await page1.locator("#MaxdateBlock").type(dob_str, delay=100)
            await asyncio.sleep(0.5)
            
            # Verify DOB was set
            dob_value = await page1.locator("#MaxdateBlock").input_value()
            self.logger.info(f"✓ Date of Birth filled: {dob_value}")
            
            # Select Gender
            gender = form_data.get('gender', 'Male')
            self.logger.debug(f"Selecting Gender: {gender}")
            await page1.get_by_role("button", name="Select Gender   ").click()
            await asyncio.sleep(0.3)
            await page1.get_by_role("listbox").get_by_role("option", name=gender, exact=True).click()
            await asyncio.sleep(0.5)
            self.logger.info(f"✓ Gender selected: {gender}")
            
            # Select Marital Status
            marital_status = form_data.get('marital_status', 'Single')
            self.logger.debug(f"Selecting Marital Status: {marital_status}")
            await page1.get_by_role("button", name="Select Marital Status   ").click()
            await asyncio.sleep(0.3)
            await page1.get_by_role("listbox").get_by_role("option", name=marital_status).click()
            await asyncio.sleep(0.5)
            self.logger.info(f"✓ Marital Status selected: {marital_status}")
            
            # Fill Phone Number field (masked input - use type)
            phone = form_data.get('phone', '501234567')
            self.logger.debug(f"Filling Phone Number: {phone}")
            await page1.locator("#Imaskphone").click()
            await asyncio.sleep(0.3)
            # Clear any default value
            await page1.locator("#Imaskphone").fill('')
            await asyncio.sleep(0.3)
            # Type the phone number for masked input
            await page1.locator("#Imaskphone").type(phone, delay=80)
            await asyncio.sleep(0.5)
            
            # Verify phone was set
            phone_value = await page1.locator("#Imaskphone").input_value()
            self.logger.info(f"✓ Phone Number filled: {phone_value}")
            
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
            self.logger.debug(f"Filling Email: {email}")
            await page1.get_by_role("textbox", name="john@gmail.com").click()
            await asyncio.sleep(0.2)
            await page1.get_by_role("textbox", name="john@gmail.com").fill(email)
            await asyncio.sleep(0.3)
            self.logger.info(f"✓ Email filled: {email}")
            

            # Select Salary Range
            salary_range = form_data.get('salary_range', '>4000 and <=12000 AED/month')
            self.logger.debug(f"Selecting Salary Range: {salary_range}")
            
            # Click the salary range button using the data-id selector
            salary_button = page1.locator('button[data-id="salaryrangeid"]')
            await salary_button.click()
            await asyncio.sleep(0.5)  # Wait for dropdown to open
            
            # Wait for the dropdown menu to be visible
            # The structure is: div#salaryrangeDiv > div.dropdown-menu.open > ul[role="listbox"]
            await page1.locator('#salaryrangeDiv div.dropdown-menu.open ul[role="listbox"]').wait_for(state='visible', timeout=5000)
            await asyncio.sleep(0.3)  # Give it time to fully render
            
            # Find the option by matching text content
            # Options are: li > a[role="option"] > span.text
            # Scope to the salary range div to avoid other dropdowns
            salary_div = page1.locator('#salaryrangeDiv')
            options = await salary_div.locator('ul[role="listbox"] a[role="option"]').all()
            
            self.logger.debug(f"Found {len(options)} salary range options")
            
            option_found = False
            for opt in options:
                try:
                    # Get the text from the span.text element inside the option
                    text_span = opt.locator('span.text')
                    if await text_span.count() > 0:
                        opt_text = await text_span.inner_text()
                        opt_text = opt_text.strip()
                        
                        self.logger.debug(f"Checking option text: '{opt_text}' against '{salary_range}'")
                        
                        # Try exact match (Playwright handles HTML entities automatically)
                        if opt_text == salary_range:
                            await opt.click()
                            option_found = True
                            self.logger.info(f"✓ Salary Range selected (exact match): {opt_text}")
                            break
                        # Try matching by normalizing the comparison symbols
                        # The HTML has &gt; and &lt; but we compare with > and <
                        normalized_opt = opt_text.replace('&gt;', '>').replace('&lt;', '<')
                        normalized_range = salary_range.replace('&gt;', '>').replace('&lt;', '<')
                        if normalized_opt == normalized_range:
                            await opt.click()
                            option_found = True
                            self.logger.info(f"✓ Salary Range selected (normalized match): {opt_text}")
                            break
                        # Try partial match - check if key parts match
                        elif 'AED/month' in opt_text and 'AED/month' in salary_range:
                            # Extract the numeric ranges for comparison
                            opt_nums = opt_text.replace('>', '').replace('<', '').replace('=', '').replace('AED/month', '').strip()
                            range_nums = salary_range.replace('>', '').replace('<', '').replace('=', '').replace('AED/month', '').strip()
                            if range_nums in opt_nums or opt_nums in range_nums:
                                await opt.click()
                                option_found = True
                                self.logger.info(f"✓ Salary Range selected (partial match): {opt_text}")
                                break
                except Exception as e:
                    self.logger.debug(f"Error checking option: {e}")
                    continue
            
            if not option_found:
                # Fallback: try using get_by_role scoped to salary div
                try:
                    await salary_div.get_by_role("listbox").get_by_role("option", name=salary_range).click()
                    option_found = True
                    self.logger.info(f"✓ Salary Range selected (role-based fallback): {salary_range}")
                except Exception as e:
                    self.logger.error(f"Could not find salary range option '{salary_range}': {e}")
                    # Log all available options for debugging
                    all_options = await salary_div.locator('ul[role="listbox"] a[role="option"] span.text').all()
                    available_texts = []
                    for opt_span in all_options:
                        try:
                            available_texts.append(await opt_span.inner_text())
                        except:
                            pass
                    self.logger.error(f"Available options: {available_texts}")
                    raise Exception(f"Failed to select salary range: {salary_range}. Available: {available_texts}")
            
            await asyncio.sleep(0.5)
            self.logger.info(f"✓ Salary Range selection complete")
            
            # Fill number of dependents (if spinbutton exists)
            num_dependents = len(form_data.get('dependents', []))
            self.logger.debug(f"Setting number of dependents: {num_dependents}")
            try:
                await page1.get_by_role("spinbutton").click()
                await page1.get_by_role("spinbutton").fill(str(num_dependents))
                await asyncio.sleep(0.3)
                self.logger.info(f"✓ Number of dependents set to: {num_dependents}")
            except Exception as e:
                self.logger.debug(f"Spinbutton not found or error: {e}, skipping...")
            
            # Click "All" button (important step from script)
            self.logger.debug("Clicking 'All' button...")
            try:
                all_button = page1.get_by_role("button", name="All   ")
                await all_button.click()
                await asyncio.sleep(0.5)  # Wait for dropdown to open
                
                # Wait for the dropdown to be visible - try multiple selector strategies
                # The dropdown might not have "open" class immediately, or structure might be different
                try:
                    await page1.wait_for_selector('div.dropdown-menu.open ul[role="listbox"]', state='visible', timeout=3000)
                except:
                    # Fallback: wait for any listbox to be visible
                    try:
                        await page1.wait_for_selector('ul[role="listbox"]', state='visible', timeout=3000)
                    except:
                        # If still not found, just proceed - dropdown might already be open
                        self.logger.debug("Dropdown might already be open, proceeding...")
                
                # Find all visible listboxes and try to find "All" option
                # Try both with and without "open" class
                listboxes = []
                try:
                    listboxes = await page1.locator('div.dropdown-menu.open ul[role="listbox"]').all()
                except:
                    pass
                
                if len(listboxes) == 0:
                    # Fallback: get all visible listboxes
                    listboxes = await page1.locator('ul[role="listbox"]').all()
                option_found = False
                
                for listbox in listboxes:
                    try:
                        options = await listbox.locator('a[role="option"]').all()
                        for opt in options:
                            # Get text from span.text if available, otherwise inner_text
                            try:
                                text_span = opt.locator('span.text')
                                if await text_span.count() > 0:
                                    opt_text = await text_span.inner_text()
                                else:
                                    opt_text = await opt.inner_text()
                            except:
                                opt_text = await opt.inner_text()
                            
                            opt_text = opt_text.strip()
                            if opt_text == "All":
                                await opt.click()
                                option_found = True
                                self.logger.info("✓ 'All' option selected")
                                break
                        if option_found:
                            break
                    except Exception as e:
                        self.logger.debug(f"Error checking listbox for 'All' option: {e}")
                        continue
                
                if not option_found:
                    # Fallback to original method
                    await page1.get_by_role("listbox").get_by_role("option", name="All").click()
                
                await asyncio.sleep(0.5)
                # Ensure dropdown closes by clicking outside or pressing Escape
                await page1.keyboard.press('Escape')
                await asyncio.sleep(0.5)  # Give it more time to close
                
                # Verify dropdown is closed by checking if no open dropdowns exist
                try:
                    open_dropdowns = await page1.locator('div.dropdown-menu.open').count()
                    if open_dropdowns > 0:
                        self.logger.debug(f"Still {open_dropdowns} open dropdown(s), pressing Escape again...")
                        await page1.keyboard.press('Escape')
                        await asyncio.sleep(0.3)
                except:
                    pass
            except Exception as e:
                self.logger.warning(f"Could not click 'All' button: {e}")
                # Ensure any open dropdowns are closed before proceeding
                try:
                    await page1.keyboard.press('Escape')
                    await asyncio.sleep(0.3)
                except:
                    pass
            
            # Select Visa Type - use more specific selector
            visa_type = form_data.get('visa_type', 'Resident visa')
            self.logger.debug(f"Selecting Visa Type: {visa_type}")
            
            # Ensure no dropdowns are open before clicking visa type button
            try:
                open_dropdowns = await page1.locator('div.dropdown-menu.open').count()
                if open_dropdowns > 0:
                    self.logger.debug("Closing any open dropdowns before opening visa type...")
                    await page1.keyboard.press('Escape')
                    await asyncio.sleep(0.5)
            except:
                pass
            
            visa_type_button = page1.get_by_role("button", name="Select Visa Type   ")
            await visa_type_button.click()
            await asyncio.sleep(0.5)  # Wait for dropdown to open
            
            # Wait for the visa type dropdown to be visible
            # Use a more specific approach: wait for the dropdown that appears after clicking the button
            try:
                # Wait for a new dropdown to open (one that wasn't there before)
                await page1.wait_for_selector('div.dropdown-menu.open ul[role="listbox"]', state='visible', timeout=5000)
            except:
                # Fallback: wait for any listbox
                try:
                    await page1.wait_for_selector('ul[role="listbox"]', state='visible', timeout=3000)
                except:
                    self.logger.debug("Dropdown might already be visible, proceeding...")
            
            await asyncio.sleep(0.3)
            
            # Find the visa type option - search through all listboxes but prioritize ones with visa type options
            listboxes = []
            try:
                listboxes = await page1.locator('div.dropdown-menu.open ul[role="listbox"]').all()
            except:
                pass
            
            if len(listboxes) == 0:
                # Fallback: get all visible listboxes
                listboxes = await page1.locator('ul[role="listbox"]').all()
            
            option_found = False
            
            # Search through listboxes to find the one with visa type option
            for listbox in listboxes:
                try:
                    options = await listbox.locator('a[role="option"]').all()
                    if len(options) == 0:
                        continue
                    
                    # Check if this listbox contains the visa type option
                    for opt in options:
                        # Get text from span.text if available, otherwise inner_text
                        try:
                            text_span = opt.locator('span.text')
                            if await text_span.count() > 0:
                                opt_text = await text_span.inner_text()
                            else:
                                opt_text = await opt.inner_text()
                        except:
                            opt_text = await opt.inner_text()
                        
                        opt_text = opt_text.strip()
                        
                        # Try exact match
                        if opt_text == visa_type:
                            await opt.click()
                            option_found = True
                            self.logger.info(f"✓ Visa Type selected (exact match): {opt_text}")
                            break
                        # Try partial match
                        elif visa_type in opt_text or opt_text in visa_type:
                            await opt.click()
                            option_found = True
                            self.logger.info(f"✓ Visa Type selected (partial match): {opt_text}")
                            break
                    
                    if option_found:
                        break
                except Exception as e:
                    self.logger.debug(f"Error checking listbox for visa type: {e}")
                    continue
            
            if not option_found:
                # Last resort: try to find the visa type button's parent container and search within it
                try:
                    # Get the button's parent container to scope the search
                    visa_button_parent = visa_type_button.locator('xpath=ancestor::div[contains(@class, "btn-group") or contains(@class, "form-group")]')
                    if await visa_button_parent.count() > 0:
                        # Search within the parent container
                        parent_listbox = visa_button_parent.locator('ul[role="listbox"]')
                        if await parent_listbox.count() > 0:
                            await parent_listbox.get_by_role("option").filter(lambda opt: visa_type in opt.inner_text() or opt.inner_text() in visa_type).first.click()
                            option_found = True
                            self.logger.info(f"✓ Visa Type selected (scoped search): {visa_type}")
                except Exception as e:
                    self.logger.debug(f"Scoped search failed: {e}")
                
                if not option_found:
                    self.logger.error(f"Could not find visa type option '{visa_type}' in any listbox")
                    # Log available options for debugging
                    try:
                        all_listboxes = await page1.locator('ul[role="listbox"]').all()
                        for idx, lb in enumerate(all_listboxes):
                            try:
                                opts = await lb.locator('a[role="option"]').all()
                                opt_texts = []
                                for o in opts[:5]:  # Limit to first 5 for logging
                                    try:
                                        txt = await o.locator('span.text').inner_text() if await o.locator('span.text').count() > 0 else await o.inner_text()
                                        opt_texts.append(txt.strip())
                                    except:
                                        pass
                                if opt_texts:
                                    self.logger.error(f"Listbox {idx} options: {opt_texts}")
                            except:
                                pass
                    except:
                        pass
                    raise Exception(f"Failed to select visa type: {visa_type}. No matching option found in any visible listbox.")
            
            await asyncio.sleep(0.5)
            
            # Verify all required fields before submission
            self.logger.info("=" * 60)
            self.logger.info("Form Filling Summary:")
            self.logger.info(f"  First Name: {form_data.get('first_name', 'Guest')}")
            self.logger.info(f"  Last Name: {form_data.get('last_name', 'User')}")
            self.logger.info(f"  Email: {form_data.get('email', 'test@gmail.com')}")
            self.logger.info(f"  Phone: {form_data.get('phone', '501234567')}")
            self.logger.info(f"  DOB: {form_data.get('dob', '18/04/1998')}")
            self.logger.info(f"  Effective Date: {form_data.get('effective_date', '31/01/2026')}")
            self.logger.info(f"  Gender: {form_data.get('gender', 'Male')}")
            self.logger.info(f"  Marital Status: {form_data.get('marital_status', 'Single')}")
            self.logger.info(f"  Nationality: {form_data.get('nationality', 'Indian')}")
            self.logger.info(f"  Visa Type: {form_data.get('visa_type', 'Resident visa')}")
            self.logger.info("=" * 60)
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(page1, "giggulf_form_filled")
            
            # Fill dependents form (this will handle navigation to plans)
            self.logger.info("Primary member form filled. Proceeding to dependents section...")
            dependents_data = form_data.get('dependents', [])
            await self.fill_dependents_form(page1, dependents_data)
            
            # Wait for navigation and check if we're on plans page
            await page1.wait_for_load_state("domcontentloaded", timeout=60000)
            await asyncio.sleep(3)
            
            # Check if we're on the plans page, if not click Next again
            current_url = page1.url
            self.logger.info(f"Current URL after dependents: {current_url}")
            
            # If still on AdditionalFamily page, click Next again to go to plans
            if "AdditionalFamily" in current_url or "ProductPlan" not in current_url:
                self.logger.info("Still on dependents page, clicking Next again to navigate to plans...")
                try:
                    await page1.get_by_role("link", name="Next").click()
                    await asyncio.sleep(3)
                    await page1.wait_for_load_state("domcontentloaded", timeout=60000)
                except Exception as e:
                    self.logger.warning(f"Could not click Next again: {e}")
            
            # Wait for plans to load - give it more time for data to render
            self.logger.debug("Waiting for plans to load...")
            await asyncio.sleep(5)  # Extra time for dynamic content to load
            
            # Check final URL
            plans_url = page1.url
            self.logger.info(f"Plans page URL: {plans_url}")
            
            # Store the new page reference so scraper can use it
            self.page = page1
            
            self.logger.info("Form filled successfully (including dependents) and plans should be loading...")
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(page1, "giggulf_plans_loaded")
        
        except Exception as e:
            self.logger.error(f"Failed to fill form: {e}")
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "giggulf_form_error")
            raise
    
    async def fill_dependents_form(self, page1, dependents_data: List[Dict[str, Any]]):
        """
        Fill dependent/family member details on the GIG Gulf portal
        Handles 0 to N dependents dynamically
        
        Args:
            page1: Playwright page object for the quotation form
            dependents_data: List of dependent dictionaries from adapter
        """
        self.logger.info("=" * 60)
        self.logger.info("DEPENDENTS SECTION")
        self.logger.info("=" * 60)
        
        if not dependents_data or len(dependents_data) == 0:
            # No dependents - skip to plans
            self.logger.info("No dependents to fill. Proceeding to plans...")
            await page1.get_by_role("link", name="Next").click()
            await asyncio.sleep(2)
            return
        
        num_dependents = len(dependents_data)
        self.logger.info(f"Filling {num_dependents} dependent(s)...")
        
        # Click Next to navigate to dependents page
        await page1.get_by_role("link", name="Next").click()
        await asyncio.sleep(2)
        
        # Wait for dependents page to load
        await page1.wait_for_load_state("domcontentloaded")
        await asyncio.sleep(1)
        
        # Fill each dependent using row index
        for index, dep in enumerate(dependents_data):
            self.logger.info(f"\n--- Filling Dependent {index + 1}/{num_dependents} ---")
            self.logger.info(f"  Name: {dep.get('full_name', 'N/A')}")
            self.logger.info(f"  Relation: {dep.get('relation', 'N/A')}")
            self.logger.info(f"  Gender: {dep.get('gender', 'N/A')}")
            
            try:
                row_id = f"#DependentRow{index}"
                
                # Select Title (MR/MS)
                title = dep.get('title', 'MR')
                self.logger.debug(f"  Selecting Title: {title}")
                await page1.locator(row_id).get_by_role("button", name="Select Title   ").click()
                await asyncio.sleep(0.3)
                await page1.get_by_role("listbox").get_by_role("option", name=title).click()
                await asyncio.sleep(0.5)
                
                # Fill Full Name - use simpler direct selector
                full_name = dep.get('full_name', 'Dependent')
                self.logger.debug(f"  Filling Name: {full_name}")
                await page1.locator(f"{row_id} input[name='DFullName']").click()
                await asyncio.sleep(0.2)
                await page1.locator(f"{row_id} input[name='DFullName']").fill(full_name)
                await asyncio.sleep(0.5)
                
                # Fill Date of Birth - use type for masked input (like primary member)
                dob = dep.get('dob', '01/01/2000')
                self.logger.debug(f"  Filling DOB: {dob}")
                dob_field = page1.locator(f"{row_id} input[placeholder='DD/MM/YYYY']")
                await dob_field.click()
                await asyncio.sleep(0.3)
                # Clear any existing value
                await dob_field.fill('')
                await asyncio.sleep(0.2)
                # Type slowly for masked input to register properly
                await dob_field.type(dob, delay=100)
                await asyncio.sleep(0.5)
                
                # Select Gender
                gender = dep.get('gender', 'Male')
                self.logger.debug(f"  Selecting Gender: {gender}")
                await page1.locator(row_id).get_by_role("button", name="Select Gender   ").click()
                await asyncio.sleep(0.3)
                await page1.get_by_role("listbox").get_by_role("option", name=gender, exact=True).click()
                await asyncio.sleep(0.5)
                
                # Select Relation
                relation = dep.get('relation', 'Child')
                self.logger.debug(f"  Selecting Relation: {relation}")
                await page1.locator(row_id).get_by_role("button", name="Select Relation   ").click()
                await asyncio.sleep(0.3)
                await page1.get_by_role("listbox").get_by_role("option", name=relation).click()
                await asyncio.sleep(0.5)
                
                # Select Marital Status
                marital_status = dep.get('marital_status', 'Single')
                self.logger.debug(f"  Selecting Marital Status: {marital_status}")
                await page1.locator(row_id).get_by_role("button", name="Select Marital Status   ").click()
                await asyncio.sleep(0.3)
                await page1.get_by_role("listbox").get_by_role("option", name=marital_status).click()
                await asyncio.sleep(0.5)
                
                # Select Nationality
                nationality = dep.get('nationality', 'Indian')
                self.logger.debug(f"  Selecting Nationality: {nationality}")
                await page1.locator(row_id).get_by_role("button", name="Select Nationality   ").click()
                await asyncio.sleep(0.3)
                await page1.get_by_role("listbox").get_by_role("option", name=nationality).click()
                await asyncio.sleep(0.5)
                
                self.logger.info(f"  ✓ Dependent {index + 1} filled successfully")
                
            except Exception as e:
                self.logger.error(f"  ❌ Error filling dependent {index + 1}: {e}")
                if self.config.get('enable_screenshots'):
                    await save_screenshot(page1, f"giggulf_dependent_{index}_error")
                raise
                self.logger.info(f"  ✓ Dependent {index + 1} filled successfully")
                
            except Exception as e:
                self.logger.error(f"  ❌ Error filling dependent {index + 1}: {e}")
                if self.config.get('enable_screenshots'):
                    await save_screenshot(page1, f"giggulf_dependent_{index}_error")
                raise
        
        self.logger.info("=" * 60)
        self.logger.info(f"All {num_dependents} dependent(s) filled successfully")
        self.logger.info("=" * 60)
        
        if self.config.get('enable_screenshots'):
            await save_screenshot(page1, "giggulf_dependents_filled")
        
        # Click Next to proceed to plans
        self.logger.info("Clicking Next to proceed to plans...")
        await page1.get_by_role("link", name="Next").click()
        await asyncio.sleep(2)