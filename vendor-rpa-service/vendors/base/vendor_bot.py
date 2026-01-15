"""
Insurance Portal RPA Bot
Main bot class for browser automation and portal interaction
"""

import asyncio
from typing import Optional, Dict, Any
from playwright.async_api import async_playwright, Browser, BrowserContext, Page, Playwright
import logging
import os


def setup_logging_for_bot(log_level: str = 'INFO'):
    """Setup logging for bot"""
    logger = logging.getLogger('InsuranceBot')
    logger.setLevel(getattr(logging, log_level.upper()))
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    return logger


class InsuranceBot:
    """
    Main bot class for automating insurance portal interactions
    """
    
    def __init__(self, credentials: Dict[str, Any], config: Optional[Dict[str, Any]] = None):
        """
        Initialize the Insurance Bot
        
        Args:
            credentials: Dictionary containing portal credentials
            config: Optional configuration dictionary
        """
        self.credentials = credentials
        self.config = config or {}
        self.logger = setup_logging_for_bot(self.config.get('log_level', 'INFO'))
        
        self.playwright: Optional[Playwright] = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        
        self.logger.info("Insurance Bot initialized")
    
    async def start(self):
        """
        Start the browser and create a new page
        """
        self.logger.info("Starting browser...")
        
        self.playwright = await async_playwright().start()
        
        # Select browser type
        browser_type = self.config.get('browser_type', 'chromium')
        if browser_type == 'firefox':
            browser_launcher = self.playwright.firefox
        elif browser_type == 'webkit':
            browser_launcher = self.playwright.webkit
        else:
            browser_launcher = self.playwright.chromium
        
        # Launch browser
        self.browser = await browser_launcher.launch(
            headless=self.config.get('headless', False),
            slow_mo=self.config.get('slow_mo', 0)
        )
        
        # Create download directory if it doesn't exist
        download_dir = self.config.get('download_dir', '/tmp/downloads')
        os.makedirs(download_dir, exist_ok=True)
        # Set permissions (important in containers)
        try:
            os.chmod(download_dir, 0o777)
        except:
            pass  # Ignore permission errors if already set
        
        # Create context and page
        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            accept_downloads=True  # CRITICAL: Enable downloads
        )
        
        # Set default timeouts
        self.context.set_default_timeout(self.config.get('default_timeout', 30000))
        self.context.set_default_navigation_timeout(self.config.get('navigation_timeout', 60000))
        
        self.page = await self.context.new_page()
        
        self.logger.info(f"Browser started: {browser_type}")
    
    async def navigate_to_portal(self):
        """
        Navigate to the insurance portal
        """
        # FIXED: Get portal URL from config, not credentials
        portal_url = self.config.get('portalUrl') or self.config.get('portal_url')
        
        if not portal_url:
            raise ValueError(f"Portal URL not found in config for {self.__class__.__name__}")
        
        self.logger.info(f"Navigating to portal: {portal_url}")
        
        try:
            await self.page.goto(portal_url, wait_until='networkidle')
            self.logger.info("Successfully navigated to portal")
        
        except Exception as e:
            self.logger.error(f"Failed to navigate to portal: {e}")
            raise
    
    async def login(self, username_selector: str = None, password_selector: str = None, 
                   submit_selector: str = None):
        """
        Perform login to the portal
        
        Args:
            username_selector: CSS selector for username field (optional, will use common patterns)
            password_selector: CSS selector for password field (optional, will use common patterns)
            submit_selector: CSS selector for submit button (optional, will use common patterns)
        
        Note:
            If selectors are not provided, you should use Playwright Codegen to record
            the login flow and update these selectors accordingly.
        """
        self.logger.info("Attempting to login...")
        
        try:
            # Navigate to login URL if provided
            login_url = self.credentials.get('login_url')
            if login_url and login_url != self.credentials.get('portal_url'):
                await self.page.goto(login_url, wait_until='networkidle')
            
            # Default selectors (common patterns)
            # These should be updated based on actual portal structure
            username_selector = username_selector or 'input[name="username"], input[type="email"], input[id*="user"], input[id*="email"]'
            password_selector = password_selector or 'input[name="password"], input[type="password"], input[id*="pass"]'
            submit_selector = submit_selector or 'button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Sign In")'
            
            # Fill username
            self.logger.debug("Filling username...")
            await self.page.fill(username_selector, self.credentials['username'])
            
            # Fill password
            self.logger.debug("Filling password...")
            await self.page.fill(password_selector, self.credentials['password'])
            
            # Click submit button
            self.logger.debug("Clicking submit button...")
            await self.page.click(submit_selector)
            
            # Wait for navigation after login
            await self.page.wait_for_load_state('networkidle')
            
            self.logger.info("Login successful")
        
        except Exception as e:
            self.logger.error(f"Login failed: {e}")
            raise
    
    async def navigate_to_plans(self, plans_url: str = None):
        """
        Navigate to the insurance plans section
        
        Args:
            plans_url: URL of the plans page (optional, uses credentials if not provided)
        """
        plans_url = plans_url or self.credentials.get('plans_url')
        
        if plans_url:
            self.logger.info(f"Navigating to plans page: {plans_url}")
            await self.page.goto(plans_url, wait_until='networkidle')
        else:
            self.logger.warning("No plans URL provided, staying on current page")
    
    async def wait_for_element(self, selector: str, timeout: int = None):
        """
        Wait for an element to be visible
        
        Args:
            selector: CSS selector for the element
            timeout: Optional timeout in milliseconds
        """
        timeout = timeout or self.config.get('default_timeout', 30000)
        await self.page.wait_for_selector(selector, state='visible', timeout=timeout)
    
    async def click_element(self, selector: str):
        """
        Click an element
        
        Args:
            selector: CSS selector for the element
        """
        self.logger.debug(f"Clicking element: {selector}")
        await self.page.click(selector)
    
    async def get_page_content(self) -> str:
        """
        Get the current page HTML content
        
        Returns:
            Page HTML content
        """
        return await self.page.content()
    
    async def execute_script(self, script: str):
        """
        Execute JavaScript on the page
        
        Args:
            script: JavaScript code to execute
        
        Returns:
            Result of the script execution
        """
        return await self.page.evaluate(script)
    
    async def close(self):
        """
        Close the browser and cleanup resources
        """
        self.logger.info("Closing browser...")
        
        if self.page:
            await self.page.close()
        
        if self.context:
            await self.context.close()
        
        if self.browser:
            await self.browser.close()
        
        if self.playwright:
            await self.playwright.stop()
        
        self.logger.info("Browser closed")
    
    async def __aenter__(self):
        """
        Async context manager entry
        """
        await self.start()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """
        Async context manager exit
        """
        await self.close()

