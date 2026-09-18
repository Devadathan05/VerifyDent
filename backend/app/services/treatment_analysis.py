from decimal import Decimal
from typing import Optional
from app.models import TreatmentBenefit as TreatmentBenefitModel, InsuranceBenefits as InsuranceBenefitsModel
from app.schemas.core import TreatmentAnalysis

# Mock fee schedule
MOCK_FEE_SCHEDULE = {
    "Crown": Decimal("1200.00"),
    "Cleaning": Decimal("150.00"),
    "X-ray": Decimal("85.00"),
    "Filling": Decimal("250.00"),
    "Root Canal": Decimal("850.00")
}

def analyze_treatment(treatment: TreatmentBenefitModel, benefits: Optional[InsuranceBenefitsModel]) -> TreatmentAnalysis:
    estimated_cost = MOCK_FEE_SCHEDULE.get(treatment.treatment, Decimal("500.00"))
    
    if not treatment.covered:
        return TreatmentAnalysis(
            treatment=treatment.treatment,
            estimated_cost=estimated_cost,
            estimated_insurance=Decimal("0.00"),
            patient_responsibility=estimated_cost,
            missing_information_message=None
        )
        
    # Check if anything is genuinely missing
    is_missing_info = False
    if treatment.coverage_percentage is None:
        is_missing_info = True
    elif treatment.frequency is not None:
        # If it has a frequency, we'd theoretically need history which we don't have
        is_missing_info = True
        
    if is_missing_info:
        return TreatmentAnalysis(
            treatment=treatment.treatment,
            estimated_cost=estimated_cost,
            estimated_insurance=None,
            patient_responsibility=None,
            missing_information_message="Coverage could not be fully confirmed. Please verify this detail with the insurance carrier before providing a final estimate."
        )
        
    # All known, calculate
    insurance_pays = estimated_cost * (treatment.coverage_percentage / Decimal("100"))
    
    # Cap at remaining maximum
    if benefits and benefits.annual_maximum_remaining is not None:
        if insurance_pays > benefits.annual_maximum_remaining:
            insurance_pays = benefits.annual_maximum_remaining
            
    patient_responsibility = estimated_cost - insurance_pays
    
    return TreatmentAnalysis(
        treatment=treatment.treatment,
        estimated_cost=estimated_cost,
        estimated_insurance=insurance_pays,
        patient_responsibility=patient_responsibility,
        missing_information_message=None
    )
