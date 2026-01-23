"""
Vendor Plugin Registry
Dynamically loads vendor bots and adapters
"""
import os
import importlib
import json
from typing import Dict, Type, Optional
from pathlib import Path


class VendorRegistry:
    """
    Registry for dynamically loading vendor plugins.
    
    Each vendor should have a directory with:
    - bot.py: Contains {VendorName}Bot class
    - adapter.py: Contains {VendorName}Adapter class
    - config.json: Vendor configuration
    """
    
    def __init__(self):
        self._bots: Dict[str, Type] = {}
        self._adapters: Dict[str, Type] = {}
        self._configs: Dict[str, Dict] = {}
        self._load_vendors()
    
    def _load_vendors(self):
        """Dynamically load all vendors from the vendors directory"""
        vendors_dir = Path(__file__).parent
        
        for vendor_dir in vendors_dir.iterdir():
            if not vendor_dir.is_dir():
                continue
            
            vendor_name = vendor_dir.name
            
            # Skip base and special directories
            if vendor_name in ['base', '__pycache__'] or vendor_name.startswith('__'):
                continue
            
            try:
                # Load bot module
                bot_module = importlib.import_module(f"vendors.{vendor_name}.bot")
                
                # Get bot class (e.g., WataniaBot)
                bot_class_name = f"{vendor_name.capitalize()}Bot"
                if hasattr(bot_module, bot_class_name):
                    self._bots[vendor_name] = getattr(bot_module, bot_class_name)
                    # Suppress stdout during registry loading (breaks JSON output)
                    # print(f"✓ Loaded bot: {vendor_name} -> {bot_class_name}")
                
                # Load adapter module
                adapter_module = importlib.import_module(f"vendors.{vendor_name}.adapter")
                
                # Get adapter class (e.g., WataniaAdapter)
                adapter_class_name = f"{vendor_name.capitalize()}Adapter"
                if hasattr(adapter_module, adapter_class_name):
                    self._adapters[vendor_name] = getattr(adapter_module, adapter_class_name)
                    # Suppress stdout during registry loading (breaks JSON output)
                    # print(f"✓ Loaded adapter: {vendor_name} -> {adapter_class_name}")
                
                # Load config
                config_path = vendor_dir / "config.json"
                if config_path.exists():
                    with open(config_path, 'r') as f:
                        self._configs[vendor_name] = json.load(f)
                    # Suppress stdout during registry loading (breaks JSON output)
                    # print(f"✓ Loaded config for: {vendor_name}")
                
            except Exception as e:
                # Log errors to stderr instead of stdout
                import sys
                print(f"✗ Could not load vendor {vendor_name}: {e}", file=sys.stderr)
    
    def get_bot(self, vendor_id: str) -> Optional[Type]:
        """
        Get bot class for a vendor.
        
        Args:
            vendor_id: Vendor identifier (e.g., 'watania', 'vendor-alsagr', 'gig-gulf')
        
        Returns:
            Bot class or None if not found
        """
        # Remove 'vendor-' prefix and replace hyphens with underscores
        clean_id = vendor_id.lower().replace('vendor-', '').replace('-', '_')
        return self._bots.get(clean_id)
    
    def get_adapter(self, vendor_id: str) -> Optional[Type]:
        """
        Get adapter class for a vendor.
        
        Args:
            vendor_id: Vendor identifier (e.g., 'watania', 'vendor-alsagr', 'gig-gulf')
        
        Returns:
            Adapter class or None if not found
        """
        # Remove 'vendor-' prefix and replace hyphens with underscores
        clean_id = vendor_id.lower().replace('vendor-', '').replace('-', '_')
        return self._adapters.get(clean_id)
    
    def get_config(self, vendor_id: str) -> Optional[Dict]:
        """
        Get configuration for a vendor.
        
        Args:
            vendor_id: Vendor identifier (e.g., 'watania', 'vendor-alsagr', 'gig-gulf')
        
        Returns:
            Configuration dictionary or None if not found
        """
        # Remove 'vendor-' prefix and replace hyphens with underscores
        clean_id = vendor_id.lower().replace('vendor-', '').replace('-', '_')
        return self._configs.get(clean_id)
    
    def list_vendors(self) -> list:
        """
        List all loaded vendors.
        
        Returns:
            List of vendor IDs
        """
        return list(self._bots.keys())
    
    def is_vendor_loaded(self, vendor_id: str) -> bool:
        """
        Check if a vendor is loaded.
        
        Args:
            vendor_id: Vendor identifier (e.g., 'watania', 'vendor-alsagr', 'gig-gulf')
        
        Returns:
            True if vendor is loaded, False otherwise
        """
        # Remove 'vendor-' prefix and replace hyphens with underscores
        clean_id = vendor_id.lower().replace('vendor-', '').replace('-', '_')
        return clean_id in self._bots


# Global registry instance
vendor_registry = VendorRegistry()


# Convenience functions
def get_vendor_bot(vendor_id: str):
    """Get bot class for vendor"""
    return vendor_registry.get_bot(vendor_id)


def get_vendor_adapter(vendor_id: str):
    """Get adapter class for vendor"""
    return vendor_registry.get_adapter(vendor_id)


def get_vendor_config(vendor_id: str):
    """Get configuration for vendor"""
    return vendor_registry.get_config(vendor_id)


__all__ = [
    'VendorRegistry',
    'vendor_registry',
    'get_vendor_bot',
    'get_vendor_adapter',
    'get_vendor_config'
]

