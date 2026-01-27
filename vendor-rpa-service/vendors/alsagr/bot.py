"""
Alsagr Insurance Portal Bot
Specialized bot for Alsagr Insurance portal automation
"""
import asyncio
import re
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
            
            # Date of Birth (date input type accepts YYYY-MM-DD format)
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
            
            # Handle "Single Member Policy" field BEFORE filling dependents
            # This is critical - the form won't submit if this isn't set correctly
            # Based on the page text, it shows "Single Member Policy? Yes No" as buttons
            has_dependents = len(dependents) > 0
            self.logger.debug(f"Single Member Policy? Has dependents: {has_dependents}")
            
            # Set "Single Member Policy" - try buttons first (most common), then radio buttons
            if has_dependents:
                # Has dependents - select "No" to reveal dependent fields
                try:
                    self.logger.info("Selecting 'No' for Single Member Policy (has dependents)...")
                    # Try button first (most common in this portal)
                    await self.page.get_by_role("button", name="No").click(timeout=10000)
                    self.logger.debug("✓ Clicked 'No' button")
                    await asyncio.sleep(1)  # Wait for dependent fields to appear
                    
                    # Wait for dependent fields to be visible
                    try:
                        await self.page.locator("#memberFirstName1").wait_for(state="visible", timeout=5000)
                        self.logger.debug("✓ Dependent fields are visible")
                    except:
                        self.logger.warning("⚠️ Dependent fields not visible after clicking 'No'")
                        
                except Exception as e:
                    self.logger.warning(f"Could not click 'No' button: {e}, trying radio...")
                    try:
                        # Try radio button
                        await self.page.get_by_role("radio", name="No").click(timeout=10000)
                        self.logger.debug("✓ Clicked 'No' radio")
                        await asyncio.sleep(1)
                        try:
                            await self.page.locator("#memberFirstName1").wait_for(state="visible", timeout=5000)
                            self.logger.debug("✓ Dependent fields are visible")
                        except:
                            self.logger.warning("⚠️ Dependent fields not visible")
                    except Exception as e2:
                        self.logger.warning(f"Could not click 'No' radio: {e2}, trying input selector...")
                        try:
                            # Try input selector
                            await self.page.locator('input[type="radio"][value="No"]').click(timeout=10000)
                            self.logger.debug("✓ Clicked 'No' input")
                            await asyncio.sleep(1)
                            try:
                                await self.page.locator("#memberFirstName1").wait_for(state="visible", timeout=5000)
                                self.logger.debug("✓ Dependent fields are visible")
                            except:
                                self.logger.warning("⚠️ Dependent fields not visible")
                        except Exception as e3:
                            self.logger.error(f"All 'No' selectors failed. Last error: {e3}")
                            # Continue anyway - might work without it
            else:
                # No dependents - select "Yes"
                try:
                    self.logger.debug("Selecting 'Yes' for Single Member Policy (no dependents)...")
                    # Try button first
                    await self.page.get_by_role("button", name="Yes").click(timeout=10000)
                    await asyncio.sleep(0.5)
                except Exception as e:
                    self.logger.warning(f"Could not click 'Yes' button: {e}, trying radio...")
                    try:
                        await self.page.get_by_role("radio", name="Yes").click(timeout=10000)
                        await asyncio.sleep(0.5)
                    except Exception as e2:
                        self.logger.warning(f"Could not click 'Yes' radio: {e2}, trying input selector...")
                        try:
                            await self.page.locator('input[type="radio"][value="Yes"]').click(timeout=10000)
                            await asyncio.sleep(0.5)
                        except Exception as e3:
                            self.logger.error(f"All 'Yes' selectors failed. Last error: {e3}")
                            # Continue anyway
            
            # NOW handle primary member in Row 1 and dependents - AFTER setting Single Member Policy
            # CRITICAL: Row 1 (#memberFirstName1, etc.) must be filled with PRIMARY member details
            # Then dependents go in Row 2, 3, etc.
            
            # Fill Row 1 with PRIMARY member details
            self.logger.info("Filling Row 1 with PRIMARY member details...")
            try:
                await self.page.locator("#memberFirstName1").fill(primary.get('firstName', primary.get('first_name', 'Guest')))
                self.logger.debug(f"  ✓ Filled Row 1 First Name: {primary.get('firstName', primary.get('first_name', 'Guest'))}")
                await asyncio.sleep(0.2)
            except Exception as e:
                self.logger.error(f"  ❌ Failed to fill Row 1 First Name: {e}")
            
            try:
                await self.page.locator("#memberLastName1").fill(primary.get('lastName', primary.get('last_name', 'User')))
                self.logger.debug(f"  ✓ Filled Row 1 Last Name: {primary.get('lastName', primary.get('last_name', 'User'))}")
                await asyncio.sleep(0.2)
            except Exception as e:
                self.logger.error(f"  ❌ Failed to fill Row 1 Last Name: {e}")
            
            try:
                await self.page.locator("#memberDateOfBirth1").fill(primary.get('dateOfBirth', primary.get('dob', '2000-01-01')))
                self.logger.debug(f"  ✓ Filled Row 1 Date of Birth: {primary.get('dateOfBirth', primary.get('dob', '2000-01-01'))}")
                await asyncio.sleep(0.3)
            except Exception as e:
                self.logger.error(f"  ❌ Failed to fill Row 1 Date of Birth: {e}")
            
            try:
                await self.page.locator("#memberGender1").select_option(primary.get('gender', '190'))
                self.logger.debug(f"  ✓ Selected Row 1 Gender: {primary.get('gender', '190')}")
                await asyncio.sleep(0.3)
            except Exception as e:
                self.logger.error(f"  ❌ Failed to select Row 1 Gender: {e}")
            
            try:
                marital_status_value = primary.get('maritalStatus', '21')
                await self.page.locator("#memberMaritalStatus1").select_option(marital_status_value)
                self.logger.debug(f"  ✓ Selected Row 1 Marital Status: {marital_status_value}")
                await asyncio.sleep(0.3)
            except Exception as e:
                self.logger.error(f"  ❌ Failed to select Row 1 Marital Status: {e}")
            
            # CRITICAL: Set relation to "Principal" for Row 1 (primary member)
            # Principal is between Spouse (48) and Parent (50) in the dropdown
            # So Principal is likely code 47 or 46
            try:
                # First, try to find Principal by searching through all options
                # This is the most reliable method
                relation_set = False
                try:
                    # Get all options from the dropdown
                    options = await self.page.locator("#relation1 option").all()
                    self.logger.debug(f"  Found {len(options)} relation options")
                    
                    for opt in options:
                        text = await opt.inner_text()
                        value = await opt.get_attribute('value')
                        text_lower = text.lower().strip()
                        
                        # Look for Principal (case-insensitive)
                        if 'principal' in text_lower and value and value != '48':  # Not Spouse
                            await self.page.locator("#relation1").select_option(value)
                            self.logger.info(f"  ✅ Selected Row 1 Relation: {text} (value: {value})")
                            relation_set = True
                            break
                    
                    if not relation_set:
                        self.logger.warning("  ⚠️ 'Principal' not found in options, trying codes...")
                except Exception as e:
                    self.logger.debug(f"  Could not search options: {e}")
                
                # Fallback: Try common Principal codes (between Spouse=48 and Parent=50)
                if not relation_set:
                    # Principal is likely 47 (between 48 and 50) or 46
                    principal_codes = ['47', '46']
                    for code in principal_codes:
                        try:
                            await self.page.locator("#relation1").select_option(code, timeout=3000)
                            selected_value = await self.page.locator("#relation1").input_value()
                            # Verify it's not Spouse (48) or Parent (50)
                            if selected_value not in ['48', '50']:
                                self.logger.info(f"  ✅ Selected Row 1 Relation: code {code} (value: {selected_value})")
                                relation_set = True
                                break
                        except:
                            continue
                
                if not relation_set:
                    self.logger.error("  ❌ FAILED to set Row 1 Relation to Principal - validation may fail!")
                else:
                    await asyncio.sleep(0.3)
            except Exception as e:
                self.logger.error(f"  ❌ Failed to select Row 1 Relation: {e}")
            
            self.logger.info("  ✅ Row 1 filled with PRIMARY member details (including Relation=Principal)")
            await asyncio.sleep(0.5)
            
            # NOW handle dependents (if any) - AFTER filling Row 1 with primary
            if has_dependents:
                self.logger.info(f"Adding {len(dependents)} dependent(s) in Row 2, 3, etc....")
                
                # Wait a bit for fields to be ready
                await asyncio.sleep(1)
                
                # Dependents go in Row 2, 3, etc. (Row 1 is already filled with primary)
                for idx, dependent in enumerate(dependents, start=1):
                    dep_name = f"{dependent.get('firstName', 'Unknown')} {dependent.get('lastName', '')}"
                    self.logger.info(f"Filling dependent #{idx}: {dep_name.strip()}")
                    
                    # CRITICAL: Click "Add New Member" FIRST to create a NEW row for this dependent
                    # Row 1 is for primary member - we need row 2, 3, etc. for dependents
                    # So dependent row index = idx + 1 (idx=1 → row 2, idx=2 → row 3, etc.)
                    dependent_row_idx = idx + 1
                    
                    self.logger.info(f"  🔘 Clicking 'Add New Member' button to create row #{dependent_row_idx} for dependent...")
                    clicked = await self._click_add_new_member_button()
                    
                    if not clicked:
                        self.logger.error(f"  ❌ FAILED to click 'Add New Member' for dependent #{idx}!")
                        self.logger.error(f"  ❌ Cannot create new row for dependent!")
                        continue
                    
                    self.logger.info(f"  ✅ Successfully clicked 'Add New Member' - waiting for row #{dependent_row_idx} to appear...")
                    await asyncio.sleep(2)  # Wait for new row to appear
                    
                    # Verify the new row fields are visible (row 2, 3, etc. - NOT row 1!)
                    try:
                        await self.page.locator(f"#memberFirstName{dependent_row_idx}").wait_for(state="visible", timeout=5000)
                        self.logger.debug(f"  ✓ Dependent row #{dependent_row_idx} is now visible")
                    except:
                        self.logger.warning(f"  ⚠️ Dependent row #{dependent_row_idx} not visible after clicking 'Add New Member'")
                    
                    # Fill dependent fields in the NEW row (row 2, 3, etc.)
                    try:
                        await self.page.locator(f"#memberFirstName{dependent_row_idx}").fill(dependent.get('firstName', ''))
                        self.logger.debug(f"  ✓ Filled First Name in row #{dependent_row_idx}: {dependent.get('firstName', '')}")
                        await asyncio.sleep(0.2)
                    except Exception as e:
                        self.logger.error(f"  ❌ Failed to fill First Name: {e}")
                    
                    try:
                        await self.page.locator(f"#memberLastName{dependent_row_idx}").fill(dependent.get('lastName', ''))
                        self.logger.debug(f"  ✓ Filled Last Name in row #{dependent_row_idx}: {dependent.get('lastName', '')}")
                        await asyncio.sleep(0.2)
                    except Exception as e:
                        self.logger.error(f"  ❌ Failed to fill Last Name: {e}")
                    
                    try:
                        # Date of Birth (date input type accepts YYYY-MM-DD format)
                        await self.page.locator(f"#memberDateOfBirth{dependent_row_idx}").fill(dependent.get('dateOfBirth', ''))
                        self.logger.debug(f"  ✓ Filled Date of Birth in row #{dependent_row_idx}: {dependent.get('dateOfBirth', '')}")
                        await asyncio.sleep(0.3)
                    except Exception as e:
                        self.logger.error(f"  ❌ Failed to fill Date of Birth: {e}")
                    
                    try:
                        await self.page.locator(f"#relation{dependent_row_idx}").select_option(dependent.get('relationshipCode', '49'))
                        self.logger.debug(f"  ✓ Selected Relation in row #{dependent_row_idx}: {dependent.get('relationshipCode', '49')}")
                        await asyncio.sleep(0.3)
                    except Exception as e:
                        self.logger.error(f"  ❌ Failed to select Relation: {e}")
                    
                    try:
                        await self.page.locator(f"#memberGender{dependent_row_idx}").select_option(dependent.get('genderCode', '190'))
                        self.logger.debug(f"  ✓ Selected Gender in row #{dependent_row_idx}: {dependent.get('genderCode', '190')}")
                        await asyncio.sleep(0.3)
                    except Exception as e:
                        self.logger.error(f"  ❌ Failed to select Gender: {e}")
                    
                    try:
                        await self.page.locator(f"#memberMaritalStatus{dependent_row_idx}").select_option(dependent.get('maritalStatusCode', '21'))
                        self.logger.debug(f"  ✓ Selected Marital Status in row #{dependent_row_idx}: {dependent.get('maritalStatusCode', '21')}")
                        await asyncio.sleep(0.3)
                    except Exception as e:
                        self.logger.error(f"  ❌ Failed to select Marital Status: {e}")
                    
                    # After filling all fields, the dependent should be in the table
                    self.logger.info(f"  ✓ Filled all fields for dependent #{idx} in row #{dependent_row_idx}")
                    await asyncio.sleep(1)  # Wait for form to register the dependent
            
            # CRITICAL: Verify dependents are in the member table before submitting
            if has_dependents:
                self.logger.info("🔍 Verifying dependents in member table before submission...")
                try:
                    # Wait a moment for table to update
                    await asyncio.sleep(1)
                    
                    # Check member table for dependent names
                    table_text = await self.page.locator("table").inner_text() if await self.page.locator("table").count() > 0 else ""
                    
                    if table_text:
                        dependent_found = False
                        for dep in dependents:
                            dep_first_name = dep.get('firstName', '').lower()
                            dep_last_name = dep.get('lastName', '').lower()
                            if dep_first_name and dep_first_name in table_text.lower():
                                dependent_found = True
                                self.logger.info(f"  ✅ Verified dependent '{dep_first_name} {dep_last_name}' in member table")
                                break
                        
                        if not dependent_found:
                            self.logger.warning("  ⚠️ Dependent not found in member table - may cause single member premium")
                            # Log table content for debugging
                            self.logger.debug(f"  Table content preview: {table_text[:200]}")
                    else:
                        self.logger.warning("  ⚠️ Member table not found - cannot verify dependents")
                except Exception as e:
                    self.logger.warning(f"  ⚠️ Could not verify dependents in table: {e}")
            
            # Click "Show Plans" button
            self.logger.info("🔘 Clicking Show Plans button...")
            await self.page.get_by_role("button", name="Show Plans").click()
            
            # Wait for plans to load
            self.logger.info("⏳ Waiting for page to load after Show Plans...")
            await self.page.wait_for_load_state("networkidle", timeout=30000)
            await asyncio.sleep(3)
            
        except Exception as e:
            self.logger.error(f"Failed to fill form: {e}")
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "alsagr_form_error")
            raise
    
    async def _click_add_new_member_button(self) -> bool:
        """
        Helper method to click the "Add New Member" button using multiple selector strategies
        Returns True if button was clicked successfully, False otherwise
        """
        try:
            # Method 1: Try by title attribute
            try:
                add_button = self.page.get_by_title("Add New Member")
                if await add_button.count() > 0:
                    await add_button.click(timeout=5000)
                    self.logger.debug("  ✓ Clicked 'Add New Member' (by title)")
                    return True
            except:
                pass
            
            # Method 2: Try by locator with title
            try:
                add_button = self.page.locator('button[title="Add New Member"]')
                if await add_button.count() > 0:
                    await add_button.click(timeout=5000)
                    self.logger.debug("  ✓ Clicked 'Add New Member' (by locator)")
                    return True
            except:
                pass
            
            # Method 3: Try by text content
            try:
                add_button = self.page.get_by_text("Add New Member", exact=False)
                if await add_button.count() > 0:
                    await add_button.click(timeout=5000)
                    self.logger.debug("  ✓ Clicked 'Add New Member' (by text)")
                    return True
            except:
                pass
            
            # Method 4: Try by role button with text pattern
            try:
                add_button = self.page.get_by_role("button", name=re.compile("Add.*Member", re.IGNORECASE))
                if await add_button.count() > 0:
                    await add_button.click(timeout=5000)
                    self.logger.debug("  ✓ Clicked 'Add New Member' (by role)")
                    return True
            except:
                pass
            
            # Method 5: Try by icon/plus button (common pattern)
            try:
                # Look for button with plus icon or add icon
                add_button = self.page.locator('button:has(svg), button[aria-label*="Add"], button[aria-label*="add"]')
                buttons = await add_button.all()
                for btn in buttons:
                    text = await btn.inner_text()
                    aria_label = await btn.get_attribute('aria-label') or ''
                    if 'add' in text.lower() or 'add' in aria_label.lower() or 'member' in text.lower():
                        await btn.click(timeout=5000)
                        self.logger.debug("  ✓ Clicked 'Add New Member' (by icon/aria-label)")
                        return True
            except:
                pass
            
            return False
        except Exception as e:
            self.logger.error(f"  ❌ Error in _click_add_new_member_button: {e}")
            return False
