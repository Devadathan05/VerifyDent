"""Service to normalize provider responses into internal representations."""

from decimal import Decimal
from typing import Any, Dict

def normalize_benefits(raw_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalizes a provider's raw JSON response into a dict suitable for creating
    an InsuranceBenefits record.
    """
    # For the MVP with our Mock Provider, the mapping is straightforward.
    # In a real app, this would handle mapping complex EDI 271 segments.
    
    general_benefits = {
        "annual_maximum": _to_decimal(raw_data.get("annual_maximum")),
        "annual_maximum_remaining": _to_decimal(raw_data.get("annual_maximum_remaining")),
        "deductible": _to_decimal(raw_data.get("deductible")),
        "deductible_remaining": _to_decimal(raw_data.get("deductible_remaining")),
        "preventive_coverage": _to_decimal(raw_data.get("preventive_coverage")),
        "basic_coverage": _to_decimal(raw_data.get("basic_coverage")),
        "major_coverage": _to_decimal(raw_data.get("major_coverage"))
    }
    
    treatment_benefits = []
    for tb in raw_data.get("treatment_benefits", []):
        treatment_benefits.append({
            "treatment": tb.get("treatment"),
            "covered": tb.get("covered", False),
            "coverage_percentage": _to_decimal(tb.get("coverage_percentage")),
            "waiting_period": tb.get("waiting_period"),
            "frequency": tb.get("frequency")
        })
        
    return {
        "general": general_benefits,
        "treatments": treatment_benefits
    }

def _to_decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (TypeError, ValueError):
        return None
