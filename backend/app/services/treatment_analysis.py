from decimal import Decimal
from typing import Optional, List
from app.models import InsuranceVerification
from app.schemas.core import (
    TreatmentPlanRequest,
    TreatmentPlanAnalysis,
    PlannedTreatmentAnalysis,
    TreatmentAnalysis
)

# Mock fee schedule
MOCK_FEE_SCHEDULE = {
    "Crown": Decimal("1200.00"),
    "Cleaning": Decimal("150.00"),
    "X-ray": Decimal("100.00"),
    "Filling": Decimal("250.00"),
    "Root Canal": Decimal("1000.00"),
    "Extraction": Decimal("300.00")
}

def analyze_treatment_plan(plan_req: TreatmentPlanRequest, verification: InsuranceVerification) -> TreatmentPlanAnalysis:
    benefits = verification.benefits
    treatment_benefits = verification.treatment_benefits
    
    total_cost = Decimal("0.00")
    total_insurance_pays = Decimal("0.00")
    
    exact_estimate_unavailable = False
    unavailable_reason = None
    capped_by_maximum = False
    
    # Check if deductible applicability is unknown
    # Since we have no `deductible_applies` field on TreatmentBenefit, it's always unknown if deductible > 0
    if benefits and benefits.deductible_remaining and benefits.deductible_remaining > Decimal("0.00"):
        exact_estimate_unavailable = True
        unavailable_reason = "Exact patient responsibility cannot be calculated from the available benefit information."
    
    analyzed_treatments: List[PlannedTreatmentAnalysis] = []
    
    for req_treatment in plan_req.treatments:
        treatment_name = req_treatment.treatment
        quantity = req_treatment.quantity
        
        # 1. Price check
        unit_price = MOCK_FEE_SCHEDULE.get(treatment_name)
        if unit_price is None:
            analyzed_treatments.append(PlannedTreatmentAnalysis(
                treatment=treatment_name,
                quantity=quantity,
                requested_cost=None,
                coverage_percentage=None,
                estimated_insurance=None,
                patient_responsibility=None,
                status="NEEDS_REVIEW",
                limitations=None,
                missing_information_message="Treatment cost is unavailable, so a financial estimate cannot be calculated for this treatment."
            ))
            exact_estimate_unavailable = True
            continue
            
        requested_cost = unit_price * quantity
        total_cost += requested_cost
        
        # 2. Find benefit rule
        t_benefit = next((tb for tb in treatment_benefits if tb.treatment.lower() == treatment_name.lower()), None)
        
        if not t_benefit:
            # Missing benefit -> NEEDS_REVIEW, not NOT_COVERED
            analyzed_treatments.append(PlannedTreatmentAnalysis(
                treatment=treatment_name,
                quantity=quantity,
                requested_cost=requested_cost,
                coverage_percentage=None,
                estimated_insurance=None,
                patient_responsibility=None,
                status="NEEDS_REVIEW",
                limitations=None,
                missing_information_message="Benefit information not found. Coverage could not be fully confirmed."
            ))
            exact_estimate_unavailable = True
            continue
            
        if not t_benefit.covered:
            analyzed_treatments.append(PlannedTreatmentAnalysis(
                treatment=treatment_name,
                quantity=quantity,
                requested_cost=requested_cost,
                coverage_percentage=Decimal("0.00"),
                estimated_insurance=Decimal("0.00"),
                patient_responsibility=requested_cost,
                status="NOT_COVERED",
                limitations=None,
                missing_information_message=None
            ))
            continue
            
        # Benefit exists and covered
        if t_benefit.coverage_percentage is None:
            analyzed_treatments.append(PlannedTreatmentAnalysis(
                treatment=treatment_name,
                quantity=quantity,
                requested_cost=requested_cost,
                coverage_percentage=None,
                estimated_insurance=None,
                patient_responsibility=None,
                status="NEEDS_REVIEW",
                limitations=None,
                missing_information_message="Coverage percentage unavailable. Coverage could not be fully confirmed."
            ))
            exact_estimate_unavailable = True
            continue
            
        # Frequency limit handling
        limitations = []
        if t_benefit.waiting_period:
            limitations.append(f"Waiting period: {t_benefit.waiting_period}")
            
        if t_benefit.frequency:
            limitations.append(f"Frequency limit: {t_benefit.frequency}")
            limitations.append("Prior utilization unavailable — remaining eligible visits cannot be confirmed.")
            exact_estimate_unavailable = True
            
            analyzed_treatments.append(PlannedTreatmentAnalysis(
                treatment=treatment_name,
                quantity=quantity,
                requested_cost=requested_cost,
                coverage_percentage=t_benefit.coverage_percentage,
                estimated_insurance=None,
                patient_responsibility=None,
                status="NEEDS_REVIEW",
                limitations="; ".join(limitations),
                missing_information_message="Frequency limit requires utilization history to calculate remaining eligibility."
            ))
            continue
            
        # If we reach here, we can estimate insurance for this treatment
        insurance_pays = requested_cost * (t_benefit.coverage_percentage / Decimal("100"))
        
        # Don't let insurance pay more than the cost
        if insurance_pays > requested_cost:
            insurance_pays = requested_cost
            
        total_insurance_pays += insurance_pays
        patient_responsibility = requested_cost - insurance_pays
        
        analyzed_treatments.append(PlannedTreatmentAnalysis(
            treatment=treatment_name,
            quantity=quantity,
            requested_cost=requested_cost,
            coverage_percentage=t_benefit.coverage_percentage,
            estimated_insurance=insurance_pays,
            patient_responsibility=max(Decimal("0.00"), patient_responsibility),
            status="ELIGIBLE",
            limitations="; ".join(limitations) if limitations else None,
            missing_information_message=None
        ))
        
    # Final aggregation and caps
    annual_maximum_remaining = benefits.annual_maximum_remaining if benefits else None
    
    if annual_maximum_remaining is not None and total_insurance_pays > annual_maximum_remaining:
        total_insurance_pays = annual_maximum_remaining
        capped_by_maximum = True
        
    final_patient_responsibility = max(Decimal("0.00"), total_cost - total_insurance_pays)
    
    return TreatmentPlanAnalysis(
        total_cost=total_cost,
        estimated_insurance=total_insurance_pays if not exact_estimate_unavailable else None,
        patient_responsibility=final_patient_responsibility if not exact_estimate_unavailable else None,
        annual_maximum_remaining=annual_maximum_remaining,
        capped_by_maximum=capped_by_maximum,
        exact_estimate_unavailable=exact_estimate_unavailable,
        unavailable_reason=unavailable_reason,
        treatments=analyzed_treatments
    )

# Maintain old method for backward compatibility if tests still import it
def analyze_treatment(treatment, benefits) -> TreatmentAnalysis:
    pass

