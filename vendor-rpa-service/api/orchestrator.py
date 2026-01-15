"""
Orchestration Manager
Handles state management for RPA orchestrations
"""
from datetime import datetime
from typing import Dict, List, Optional
import logging
from azure.cosmos import CosmosClient, PartitionKey
from models import StandardLead, VendorResult, OrchestrationStatus, StandardPlan

logger = logging.getLogger(__name__)


class OrchestrationManager:
    """Manages orchestration state in Cosmos DB"""
    
    def __init__(self, storage_connection: str, cosmos_endpoint: str = None, cosmos_key: str = None):
        self.storage_connection = storage_connection
        
        # In-memory storage for development (fallback)
        self._orchestrations: Dict = {}
        
        # Cosmos DB for production
        self.cosmos_client = None
        self.database = None
        self.container = None
        
        if cosmos_endpoint and cosmos_key:
            try:
                self.cosmos_client = CosmosClient(cosmos_endpoint, cosmos_key)
                self.database = self.cosmos_client.get_database_client("quotation-generation-service")
                
                # Try to get or create container
                try:
                    self.container = self.database.get_container_client("rpa-orchestrations")
                except Exception:
                    # Create container if it doesn't exist
                    self.container = self.database.create_container(
                        id="rpa-orchestrations",
                        partition_key=PartitionKey(path="/orchestrationId"),
                        offer_throughput=400
                    )
                    logger.info("Created rpa-orchestrations container")
                    
                logger.info("Connected to Cosmos DB for orchestration storage")
            except Exception as e:
                logger.warning(f"Could not connect to Cosmos DB: {e}. Using in-memory storage.")
    
    async def create_orchestration(
        self,
        orchestration_id: str,
        standard_lead: StandardLead,
        vendor_ids: List[str]
    ):
        """Create a new orchestration record"""
        orchestration = {
            "id": orchestration_id,
            "orchestrationId": orchestration_id,  # Partition key
            "status": "running",
            "standardLead": standard_lead.model_dump(),
            "vendorIds": vendor_ids,
            "totalVendors": len(vendor_ids),
            "completedVendors": 0,
            "successfulVendors": 0,
            "failedVendors": 0,
            "results": [],
            "plans": [],
            "startTime": datetime.now().isoformat(),
            "endTime": None,
            "errors": []
        }
        
        # Save to Cosmos or memory
        if self.container:
            try:
                self.container.create_item(body=orchestration)
                logger.info(f"Saved orchestration {orchestration_id} to Cosmos DB")
            except Exception as e:
                logger.error(f"Error saving to Cosmos DB: {e}")
                self._orchestrations[orchestration_id] = orchestration
        else:
            self._orchestrations[orchestration_id] = orchestration
    
    async def add_result(
        self,
        orchestration_id: str,
        vendor_id: str,
        result: VendorResult
    ):
        """Add a vendor result to the orchestration"""
        orch = await self._get_orchestration(orchestration_id)
        
        if not orch:
            logger.error(f"Orchestration {orchestration_id} not found")
            return
        
        # Add result
        result_dict = result.model_dump()
        orch['results'].append(result_dict)
        orch['completedVendors'] = len(orch['results'])
        
        # Update counters
        if result.success:
            orch['successfulVendors'] += 1
            # Add plans
            orch['plans'].extend([p.model_dump() if hasattr(p, 'model_dump') else p for p in result.plans])
        else:
            orch['failedVendors'] += 1
            orch['errors'].append({
                "vendorId": vendor_id,
                "error": result.error,
                "timestamp": datetime.now().isoformat()
            })
        
        # Save
        await self._save_orchestration(orchestration_id, orch)
    
    async def complete_orchestration(self, orchestration_id: str):
        """Mark orchestration as completed"""
        orch = await self._get_orchestration(orchestration_id)
        
        if not orch:
            return
        
        orch['status'] = 'completed'
        orch['endTime'] = datetime.now().isoformat()
        
        await self._save_orchestration(orchestration_id, orch)
        logger.info(f"Orchestration {orchestration_id} completed")
    
    async def fail_orchestration(self, orchestration_id: str, error: str):
        """Mark orchestration as failed"""
        orch = await self._get_orchestration(orchestration_id)
        
        if not orch:
            return
        
        orch['status'] = 'failed'
        orch['endTime'] = datetime.now().isoformat()
        orch['errors'].append({
            "error": error,
            "timestamp": datetime.now().isoformat()
        })
        
        await self._save_orchestration(orchestration_id, orch)
        logger.error(f"Orchestration {orchestration_id} failed: {error}")
    
    async def get_status(self, orchestration_id: str) -> Optional[OrchestrationStatus]:
        """Get orchestration status"""
        orch = await self._get_orchestration(orchestration_id)
        
        if not orch:
            return None
        
        # Convert to OrchestrationStatus model
        return OrchestrationStatus(
            orchestrationId=orch['orchestrationId'],
            status=orch['status'],
            totalVendors=orch['totalVendors'],
            completedVendors=orch['completedVendors'],
            successfulVendors=orch['successfulVendors'],
            failedVendors=orch['failedVendors'],
            plans=[StandardPlan(**p) if isinstance(p, dict) else p for p in orch['plans']],
            startTime=datetime.fromisoformat(orch['startTime']),
            endTime=datetime.fromisoformat(orch['endTime']) if orch.get('endTime') else None,
            errors=orch.get('errors', [])
        )
    
    async def _get_orchestration(self, orchestration_id: str) -> Optional[Dict]:
        """Get orchestration from storage"""
        if self.container:
            try:
                item = self.container.read_item(
                    item=orchestration_id,
                    partition_key=orchestration_id
                )
                return item
            except Exception as e:
                logger.debug(f"Could not read from Cosmos DB: {e}")
        
        # Fallback to memory
        return self._orchestrations.get(orchestration_id)
    
    async def _save_orchestration(self, orchestration_id: str, orch: Dict):
        """Save orchestration to storage"""
        if self.container:
            try:
                self.container.upsert_item(body=orch)
                return
            except Exception as e:
                logger.error(f"Error saving to Cosmos DB: {e}")
        
        # Fallback to memory
        self._orchestrations[orchestration_id] = orch

