"""Verification orchestrator service."""

import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models import (
    InsuranceVerification,
    PayerResponse,
    InsuranceBenefits,
    VerificationEvent,
    Patient,
    InsurancePolicy,
    TreatmentBenefit
)
from app.providers.registry import get_provider_registry
from app.providers.base import VerificationRequest
from app.services.payer import identify_payer
from app.services.normalization import normalize_benefits

async def run_verification(
    patient: Patient,
    policy: InsurancePolicy,
    db: Session
) -> InsuranceVerification:
    """Orchestrates the entire insurance verification workflow."""
    
    # 1. Create initial verification record and log start
    verification = InsuranceVerification(
        patient_id=patient.id,
        insurance_policy_id=policy.id,
        status="pending"
    )
    db.add(verification)
    db.flush() # To get verification.id
    
    _log_event(db, verification.id, "VERIFICATION_STARTED", "Verification requested")
    
    # 2. Identify Payer
    payer_name = identify_payer(policy.payer_name)
    _log_event(db, verification.id, "PAYER_IDENTIFIED", f"Identified payer: {payer_name}")
    
    if payer_name == "UNKNOWN":
        verification.status = "NEEDS_REVIEW"
        verification.error_message = f"Could not confidently identify payer from '{policy.payer_name}'"
        _log_event(db, verification.id, "NEEDS_REVIEW", verification.error_message)
        db.commit()
        db.refresh(verification)
        return verification

    # 3. Validate required fields
    if not policy.member_id:
        verification.status = "NEEDS_REVIEW"
        verification.error_message = "Missing member ID"
        _log_event(db, verification.id, "NEEDS_REVIEW", verification.error_message)
        db.commit()
        db.refresh(verification)
        return verification

    # 4. Select Verification Provider
    registry = get_provider_registry()
    provider = registry.get_provider(payer_name)
    
    if not provider:
        verification.status = "NEEDS_REVIEW"
        verification.error_message = "No provider configured for payer"
        _log_event(db, verification.id, "NEEDS_REVIEW", verification.error_message)
        db.commit()
        db.refresh(verification)
        return verification
        
    # 5. Send verification request
    request = VerificationRequest(
        subscriber_id=policy.member_id,
        carrier_id=payer_name,
        plan_id=policy.group_number
    )
    
    try:
        result = await provider.verify(request)
    except Exception as e:
        verification.status = "FAILED"
        verification.error_message = f"Provider error: {str(e)}"
        _log_event(db, verification.id, "FAILED", verification.error_message)
        db.commit()
        db.refresh(verification)
        return verification
        
    # 6. Store Raw Response
    payer_resp = PayerResponse(
        verification_id=verification.id,
        source="MockProvider",
        response_format="JSON",
        raw_response=result.raw_response
    )
    db.add(payer_resp)
    
    # 7. Normalize Response
    try:
        raw_data = json.loads(result.raw_response)
        normalized_data = normalize_benefits(raw_data)
        
        benefits = InsuranceBenefits(
            verification_id=verification.id,
            **normalized_data["general"]
        )
        db.add(benefits)
        
        for tb_data in normalized_data["treatments"]:
            tb = TreatmentBenefit(
                verification_id=verification.id,
                **tb_data
            )
            db.add(tb)
        
        verification.status = "VERIFIED" if result.is_active else "FAILED"
        verification.verified_at = datetime.now(timezone.utc)
        verification.verification_source = "MockProvider"
        
        _log_event(db, verification.id, "VERIFICATION_COMPLETED", f"Status: {verification.status}")
        
    except Exception as e:
        verification.status = "NEEDS_REVIEW"
        verification.error_message = f"Failed to normalize response: {str(e)}"
        _log_event(db, verification.id, "NEEDS_REVIEW", verification.error_message)

    db.commit()
    db.refresh(verification)
    return verification


def _log_event(db: Session, verification_id, event_type: str, message: str):
    event = VerificationEvent(
        verification_id=verification_id,
        event_type=event_type,
        message=message,
        source="System"
    )
    db.add(event)
