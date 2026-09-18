from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class MappingTraceItem(BaseModel):
    provider: Optional[str] = None
    schema_version: Optional[str] = None
    source: str
    target: str
    mapping_type: str = "explicit"

class TreatmentBenefitBase(BaseModel):
    treatment: str
    covered: bool
    coverage_percentage: Optional[float] = None
    waiting_period: Optional[str] = None
    frequency: Optional[str] = None

class NormalizedBenefits(BaseModel):
    # Provider metadata
    provider_source: Optional[str] = None
    provider_environment: Optional[str] = None
    provider_schema_version: Optional[str] = None
    
    # Payer/carrier
    payer_id: Optional[str] = None
    payer_name: Optional[str] = None
    
    # Group
    group_number: Optional[str] = None
    group_name: Optional[str] = None
    employer_name: Optional[str] = None
    
    # Plan
    plan_id: Optional[str] = None
    plan_name: Optional[str] = None
    plan_type: Optional[str] = None
    effective_date: Optional[str] = None
    termination_date: Optional[str] = None
    
    # Subscriber
    subscriber_id: Optional[str] = None
    subscriber_name: Optional[str] = None
    subscriber_relationship: Optional[str] = None
    
    # Member
    member_id: Optional[str] = None
    member_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    relationship_to_subscriber: Optional[str] = None
    
    # Eligibility & Benefits
    eligibility_status: Optional[str] = None
    annual_maximum: Optional[float] = None
    annual_maximum_remaining: Optional[float] = None
    deductible: Optional[float] = None
    deductible_remaining: Optional[float] = None
    preventive_coverage: Optional[float] = None
    basic_coverage: Optional[float] = None
    major_coverage: Optional[float] = None
    treatment_benefits: List[TreatmentBenefitBase] = Field(default_factory=list)

class NormalizationDemoResponse(BaseModel):
    provider: str
    raw_response: Dict[str, Any]
    normalized: NormalizedBenefits
    mapping_trace: List[MappingTraceItem]
