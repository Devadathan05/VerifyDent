from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.models import InsurancePolicy as PolicyModel, InsuranceVerification as VerificationModel, Patient as PatientModel
from app.schemas import InsurancePolicy, InsurancePolicyCreate, InsuranceVerification

policies_router = APIRouter()
verifications_router = APIRouter()

@policies_router.post("/", response_model=InsurancePolicy, status_code=status.HTTP_201_CREATED)
def create_policy(policy_in: InsurancePolicyCreate, db: Session = Depends(get_db)):
    # Verify patient exists
    db_patient = db.get(PatientModel, policy_in.patient_id)
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    db_policy = PolicyModel(**policy_in.model_dump())
    db.add(db_policy)
    db.commit()
    db.refresh(db_policy)
    return db_policy

@policies_router.get("/{policy_id}", response_model=InsurancePolicy)
def get_policy(policy_id: UUID, db: Session = Depends(get_db)):
    db_policy = db.get(PolicyModel, policy_id)
    if not db_policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return db_policy

@verifications_router.get("/{verification_id}", response_model=InsuranceVerification)
def get_verification(verification_id: UUID, db: Session = Depends(get_db)):
    db_verification = db.get(VerificationModel, verification_id)
    if not db_verification:
        raise HTTPException(status_code=404, detail="Verification not found")
    return db_verification
