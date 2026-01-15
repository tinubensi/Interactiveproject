"""
Data Models for Vendor RPA Service
Standard interfaces for lead input and plan output
"""
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from datetime import datetime
from enum import Enum


class LineOfBusiness(str, Enum):
    """Supported lines of business"""
    MEDICAL = "Medical"
    MOTOR = "Motor"
    HOME = "Home"
    TRAVEL = "Travel"


class StandardLead(BaseModel):
    """
    Standardized lead data structure
    Clean interface for vendor adapters to consume
    """
    leadId: str = Field(..., description="Unique lead identifier")
    firstName: str
    lastName: str
    fullName: str
    email: str
    phone: Dict[str, str] = Field(..., description="Phone with countryCode, number, isoCode")
    emirate: str
    lineOfBusiness: str
    businessType: str
    dob: str = Field(..., description="Date of birth in ISO format")
    gender: str = Field(..., description="Male, Female, or Other")
    
    # Optional LOB-specific data (adapters extract what they need)
    lobData: Optional[Dict] = Field(default=None, description="Line of business specific data")
    
    createdAt: Optional[str] = Field(default=None, description="Lead creation timestamp")


class StandardPlan(BaseModel):
    """
    Standardized plan data structure - Unified Structure V2
    Clean interface for vendor adapters to produce
    Supports optional sub-limits, network details, structured copays, and waiting periods
    """
    # Core Identifiers
    id: str = Field(..., description="Unique plan identifier")
    leadId: str
    vendorId: str
    vendorName: str
    vendorCode: Optional[str] = Field(default=None, description="Vendor short code (e.g., ALS, TKF, WAT)")
    
    # Plan Details
    planName: str
    planCode: Optional[str] = None
    planType: Optional[str] = None
    
    # Pricing
    annualPremium: float
    monthlyPremium: Optional[float] = None
    currency: str = Field(default="AED")
    
    # Coverage Limits (required)
    coverageAmount: float  # Deprecated: Use annualLimit for new implementations
    annualLimit: Optional[float] = Field(default=None, description="Annual coverage limit (replaces coverageAmount)")
    
    # Optional Sub-Limits (Unified Structure V2)
    inpatientLimit: Optional[float] = Field(default=None, description="Inpatient care annual limit")
    outpatientLimit: Optional[float] = Field(default=None, description="Outpatient care annual limit")
    maternityLimit: Optional[float] = Field(default=None, description="Maternity coverage limit")
    emergencyLimit: Optional[float] = Field(default=None, description="Emergency care limit")
    pharmacyLimit: Optional[float] = Field(default=None, description="Pharmacy/medication limit")
    dentalLimit: Optional[float] = Field(default=None, description="Dental care limit")
    opticalLimit: Optional[float] = Field(default=None, description="Optical/vision care limit")
    
    # Cost Sharing
    deductible: Optional[float] = None
    deductibleMetric: Optional[str] = Field(default="AED", description="Metric for deductible (AED, USD, etc.)")
    coInsurance: Optional[float] = None
    coInsuranceMetric: Optional[str] = Field(default="%", description="Metric for coInsurance (%, ratio)")
    copays: Optional[Dict] = Field(default=None, description="Flexible copay structure (e.g., {gpVisit: 50, emergency: 100})")
    
    # Waiting Periods
    waitingPeriod: Optional[int] = Field(default=None, description="General waiting period in days")
    waitingPeriodMetric: Optional[str] = Field(default="days", description="Metric for waiting period")
    waitingPeriods: Optional[Dict[str, int]] = Field(default=None, description="Structured waiting periods (e.g., {general: 30, maternity: 300})")
    
    # Network Information (Unified Structure V2)
    network: Optional[Dict] = Field(default=None, description="Network details (e.g., {tpa: 'E-Care', networkName: 'Premium Network'})")
    
    # Benefits and Exclusions
    benefits: Optional[List] = Field(default_factory=list, description="Benefits as list of strings or categorized structure")
    exclusions: Optional[List[str]] = Field(default_factory=list)
    
    # Metadata
    lineOfBusiness: Optional[str] = Field(default="medical", description="Insurance line of business")
    lobSpecificData: Optional[Dict] = Field(default=None, description="LOB-specific additional data")
    isAvailable: Optional[bool] = Field(default=True)
    isSelected: Optional[bool] = Field(default=False)
    isRecommended: Optional[bool] = Field(default=False)
    fetchRequestId: Optional[str] = Field(default="", description="Request ID for tracking")
    fetchedAt: str = Field(..., description="When the plan was fetched")
    source: Optional[str] = Field(default="rpa", description="Source of the plan data")
    
    # Raw Data
    rawPlanData: Optional[Dict] = Field(default=None, description="Raw vendor data for debugging")
    rawData: Optional[Dict] = Field(default=None, description="DEPRECATED: Use rawPlanData instead")


class VendorConfig(BaseModel):
    """Vendor configuration"""
    id: str
    name: str
    enabled: bool = True
    portalUrl: str
    requiresAuth: bool = False
    authUrl: Optional[str] = None
    timeout: int = Field(default=90, description="Timeout in seconds")
    priority: int = Field(default=5, description="Execution priority (1-10)")


class VendorTaskPayload(BaseModel):
    """Payload sent to queue for container execution"""
    vendorId: str
    standardLead: StandardLead
    orchestrationId: str
    callbackUrl: str
    timeout: int = 60


class VendorResult(BaseModel):
    """Result returned from container via webhook"""
    orchestrationId: str
    vendorId: str
    success: bool
    plans: List[StandardPlan]
    error: Optional[str] = None
    executionTime: Optional[float] = Field(default=None, description="Execution time in seconds")


class OrchestrationStatus(BaseModel):
    """Orchestration status response"""
    orchestrationId: str
    status: str = Field(..., description="running, completed, failed")
    totalVendors: int
    completedVendors: int
    successfulVendors: int
    failedVendors: int
    plans: List[StandardPlan]
    startTime: datetime
    endTime: Optional[datetime] = None
    errors: List[Dict] = Field(default_factory=list)


class GetQuotesRequest(BaseModel):
    """Request to start quote fetching"""
    lead: Dict = Field(..., description="Full lead object from lead-service")
    vendorIds: Optional[List[str]] = Field(default=None, description="Specific vendors to query")


class GetQuotesResponse(BaseModel):
    """Response when starting quote orchestration"""
    orchestrationId: str
    status: str
    statusQueryGetUri: str
    totalVendors: int
    message: str

