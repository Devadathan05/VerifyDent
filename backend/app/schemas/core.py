from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

class PatientBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    date_of_birth: date

class PatientCreate(PatientBase):
    pass

class Patient(PatientBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class InsurancePolicyBase(BaseModel):
    payer_name: str = Field(..., min_length=1, max_length=100)
    member_id: str = Field(..., min_length=1, max_length=50)
    group_number: Optional[str] = None
    policy_number: Optional[str] = None
    subscriber_name: Optional[str] = None
    relationship_to_subscriber: Optional[str] = None
    effective_date: Optional[date] = None
    termination_date: Optional[date] = None

class InsurancePolicyCreate(InsurancePolicyBase):
    patient_id: UUID

class InsurancePolicy(InsurancePolicyBase):
    id: UUID
    patient_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class InsuranceVerificationBase(BaseModel):
    patient_id: UUID
    insurance_policy_id: UUID
    status: str = "pending"
    verification_source: Optional[str] = None
    verification_reference: Optional[str] = None

class InsuranceVerificationCreate(InsuranceVerificationBase):
    pass

class InsuranceVerification(InsuranceVerificationBase):
    id: UUID
    verified_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime
    
    benefits: Optional["InsuranceBenefits"] = None
    events: List["VerificationEvent"] = []
    treatment_benefits: List["TreatmentBenefit"] = []

    model_config = ConfigDict(from_attributes=True)

class InsuranceBenefitsBase(BaseModel):
    annual_maximum: Optional[Decimal] = None
    annual_maximum_remaining: Optional[Decimal] = None
    deductible: Optional[Decimal] = None
    deductible_remaining: Optional[Decimal] = None
    preventive_coverage: Optional[Decimal] = None
    basic_coverage: Optional[Decimal] = None
    major_coverage: Optional[Decimal] = None

class InsuranceBenefits(InsuranceBenefitsBase):
    id: UUID
    verification_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class BenefitLimitationBase(BaseModel):
    procedure_code: str
    procedure_name: Optional[str] = None
    limitation_type: str
    limitation_value: Optional[Decimal] = None
    limitation_unit: Optional[str] = None
    description: Optional[str] = None

class BenefitLimitation(BenefitLimitationBase):
    id: UUID
    verification_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class VerificationEventBase(BaseModel):
    event_type: str
    message: Optional[str] = None
    source: Optional[str] = None

class VerificationEvent(VerificationEventBase):
    id: UUID
    verification_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class PayerResponseBase(BaseModel):
    source: str
    response_format: str
    raw_response: str
    received_at: Optional[datetime] = None

class PayerResponse(PayerResponseBase):
    id: UUID
    verification_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class TreatmentBenefitBase(BaseModel):
    treatment: str
    covered: bool
    coverage_percentage: Optional[Decimal] = None
    waiting_period: Optional[str] = None
    frequency: Optional[str] = None

class TreatmentBenefit(TreatmentBenefitBase):
    id: UUID
    verification_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class VerificationRequestPayload(BaseModel):
    patient: PatientCreate
    policy: InsurancePolicyBase

class TreatmentAnalysis(BaseModel):
    treatment: str
    estimated_cost: Optional[Decimal] = None
    estimated_insurance: Optional[Decimal] = None
    patient_responsibility: Optional[Decimal] = None
    missing_information_message: Optional[str] = None

class PlannedTreatment(BaseModel):
    treatment: str
    quantity: int = 1
    planned_date: Optional[date] = None
    notes: Optional[str] = None

class TreatmentPlanRequest(BaseModel):
    treatments: List[PlannedTreatment]

class PlannedTreatmentAnalysis(BaseModel):
    treatment: str
    quantity: int
    requested_cost: Optional[Decimal] = None
    coverage_percentage: Optional[Decimal] = None
    estimated_insurance: Optional[Decimal] = None
    patient_responsibility: Optional[Decimal] = None
    status: str
    limitations: Optional[str] = None
    missing_information_message: Optional[str] = None

class TreatmentPlanAnalysis(BaseModel):
    total_cost: Optional[Decimal] = None
    estimated_insurance: Optional[Decimal] = None
    patient_responsibility: Optional[Decimal] = None
    annual_maximum_remaining: Optional[Decimal] = None
    capped_by_maximum: bool = False
    exact_estimate_unavailable: bool = False
    unavailable_reason: Optional[str] = None
    treatments: List[PlannedTreatmentAnalysis]
