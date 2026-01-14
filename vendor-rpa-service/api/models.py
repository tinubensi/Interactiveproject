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
    Standardized plan data structure
    Clean interface for vendor adapters to produce
    """
    id: str = Field(..., description="Unique plan identifier")
    leadId: str
    vendorId: str
    vendorName: str
    planName: str
    planCode: Optional[str] = None
    planType: Optional[str] = None
    annualPremium: float
    monthlyPremium: Optional[float] = None
    currency: str = Field(default="AED")
    coverageAmount: float
    deductible: Optional[float] = None
    coInsurance: Optional[float] = None
    waitingPeriod: Optional[int] = Field(default=None, description="Waiting period in days")
    benefits: Optional[List[str]] = Field(default_factory=list)
    exclusions: Optional[List[str]] = Field(default_factory=list)
    fetchedAt: str = Field(..., description="When the plan was fetched")
    rawData: Optional[Dict] = Field(default=None, description="Raw vendor data for debugging")


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

