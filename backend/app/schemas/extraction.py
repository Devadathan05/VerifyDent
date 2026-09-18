"""Schema for the document extraction (upload) API response."""

from datetime import datetime
from typing import Dict, Optional

from pydantic import BaseModel, Field


class ExtractedValue(BaseModel):
    value: Optional[str] = None
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class InsuranceExtractionResponse(BaseModel):
    """Structured extraction result returned by ``POST /api/insurance/upload``.

    The ``required_fields`` list tells the frontend which fields must be
    confirmed by a human before the result may be used downstream.
    """

    status: str = "extracted"
    extracted_at: datetime
    file_name: str
    file_type: str
    provider: str
    requires_confirmation: bool = True
    required_fields: list[str] = [
        "first_name",
        "last_name",
        "date_of_birth",
        "member_id",
        "payer_name",
    ]
    raw_text: str = ""
    fields: Dict[str, ExtractedValue]

    model_config = {"json_schema_extra": {"example": {
        "status": "extracted",
        "file_name": "sample_insurance_card.png",
        "file_type": "png",
        "provider": "mock",
        "requires_confirmation": True,
        "fields": {
            "member_id": {"value": "ABC123456", "confidence": 0.98},
            "payer_name": {"value": "Delta Dental of California", "confidence": 0.98},
        },
    }}}


__all__ = ["ExtractedValue", "InsuranceExtractionResponse"]