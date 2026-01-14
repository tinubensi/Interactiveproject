"""
Utility functions for the Insurance Portal RPA Bot
"""

import json
import os
import logging
from pathlib import Path
from typing import Dict, Any
from datetime import datetime


def setup_logging(log_level: str = "INFO") -> logging.Logger:
    """
    Set up logging configuration
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR)
    
    Returns:
        Configured logger instance
    """
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    return logging.getLogger("InsuranceBot")


def load_credentials(config_path: str = None) -> Dict[str, Any]:
    """
    Load credentials from JSON file
    
    Args:
        config_path: Path to credentials JSON file
    
    Returns:
        Dictionary containing credentials
    
    Raises:
        FileNotFoundError: If credentials file doesn't exist
        json.JSONDecodeError: If credentials file is invalid JSON
    """
    if config_path is None:
        # Default to config/credentials.json in project root
        project_root = Path(__file__).parent.parent.parent
        config_path = project_root / "config" / "credentials.json"
    
    config_path = Path(config_path)
    
    if not config_path.exists():
        raise FileNotFoundError(
            f"Credentials file not found at {config_path}. "
            f"Please copy config/credentials.json.example to config/credentials.json "
            f"and fill in your credentials."
        )
    
    with open(config_path, 'r') as f:
        credentials = json.load(f)
    
    # Validate required fields
    required_fields = ['portal_url', 'username', 'password']
    missing_fields = [field for field in required_fields if field not in credentials]
    
    if missing_fields:
        raise ValueError(f"Missing required fields in credentials: {', '.join(missing_fields)}")
    
    return credentials


def load_env_config() -> Dict[str, Any]:
    """
    Load configuration from environment variables
    
    Returns:
        Dictionary containing configuration settings
    """
    from dotenv import load_dotenv
    
    # Load .env file if it exists
    project_root = Path(__file__).parent.parent.parent
    env_path = project_root / ".env"
    
    if env_path.exists():
        load_dotenv(env_path)
    
    config = {
        'headless': os.getenv('HEADLESS', 'true').lower() == 'true',
        'browser_type': os.getenv('BROWSER_TYPE', 'chromium').lower(),
        'slow_mo': int(os.getenv('SLOW_MO', '0')),
        'default_timeout': int(os.getenv('DEFAULT_TIMEOUT', '30000')),
        'navigation_timeout': int(os.getenv('NAVIGATION_TIMEOUT', '60000')),
        'enable_screenshots': os.getenv('ENABLE_SCREENSHOTS', 'false').lower() == 'true',
        'screenshot_dir': os.getenv('SCREENSHOT_DIR', '/tmp/screenshots'),
        'log_level': os.getenv('LOG_LEVEL', 'INFO').upper()
    }
    
    return config


def ensure_directory(directory: str) -> Path:
    """
    Ensure a directory exists, create if it doesn't
    
    Args:
        directory: Directory path to ensure
    
    Returns:
        Path object of the directory
    """
    dir_path = Path(directory)
    dir_path.mkdir(parents=True, exist_ok=True)
    return dir_path


async def save_screenshot(page, name: str, screenshot_dir: str = "/tmp/screenshots") -> str:
    """
    Save a screenshot of the current page
    
    Args:
        page: Playwright page object
        name: Name for the screenshot file
        screenshot_dir: Directory to save screenshots
    
    Returns:
        Path to saved screenshot
    """
    ensure_directory(screenshot_dir)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{name}_{timestamp}.png"
    filepath = Path(screenshot_dir) / filename
    await page.screenshot(path=str(filepath))
    return str(filepath)


def clean_text(text: str) -> str:
    """
    Clean and normalize extracted text
    
    Args:
        text: Raw text to clean
    
    Returns:
        Cleaned text
    """
    if not text:
        return ""
    
    # Remove extra whitespace
    text = " ".join(text.split())
    # Strip leading/trailing whitespace
    text = text.strip()
    
    return text


