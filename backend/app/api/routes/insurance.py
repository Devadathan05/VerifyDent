from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.models import InsurancePolicy as PolicyModel, InsuranceVerification as VerificationModel, Patient as PatientModel
from app.schemas.core import InsurancePolicy, InsurancePolicyCreate, InsuranceVerification, VerificationRequestPayload
from app.services.verification import run_verification

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

@verifications_router.post("/", response_model=InsuranceVerification, status_code=status.HTTP_201_CREATED)
async def create_verification(payload: VerificationRequestPayload, db: Session = Depends(get_db)):
    # 1. Create Patient
    db_patient = PatientModel(**payload.patient.model_dump())
    db.add(db_patient)
    db.flush()
    
    # 2. Create Policy
    db_policy = PolicyModel(**payload.policy.model_dump(), patient_id=db_patient.id)
    db.add(db_policy)
    db.flush()
    
    # 3. Run verification orchestrator
    verification = await run_verification(db_patient, db_policy, db)
    return verification

@verifications_router.get("/{verification_id}", response_model=InsuranceVerification)
def get_verification(verification_id: UUID, db: Session = Depends(get_db)):
    db_verification = db.get(VerificationModel, verification_id)
    if not db_verification:
        raise HTTPException(status_code=404, detail="Verification not found")
    return db_verification

from app.schemas.core import TreatmentAnalysis, TreatmentPlanRequest, TreatmentPlanAnalysis
from app.services.treatment_analysis import analyze_treatment, analyze_treatment_plan
from app.models import TreatmentBenefit as TreatmentBenefitModel
from urllib.parse import unquote

@verifications_router.post("/{verification_id}/treatment-plan/analysis", response_model=TreatmentPlanAnalysis)
def analyze_treatment_plan_endpoint(verification_id: UUID, plan_in: TreatmentPlanRequest, db: Session = Depends(get_db)):
    db_verification = db.get(VerificationModel, verification_id)
    if not db_verification:
        raise HTTPException(status_code=404, detail="Verification not found")
        
    analysis = analyze_treatment_plan(plan_in, db_verification)
    return analysis

@verifications_router.get("/{verification_id}/treatments/{treatment_name}/analysis", response_model=TreatmentAnalysis)
def get_treatment_analysis(verification_id: UUID, treatment_name: str, db: Session = Depends(get_db)):
    db_verification = db.get(VerificationModel, verification_id)
    if not db_verification:
        raise HTTPException(status_code=404, detail="Verification not found")
        
    decoded_treatment = unquote(treatment_name)
    
    # Find the treatment
    treatment = next((t for t in db_verification.treatment_benefits if t.treatment.lower() == decoded_treatment.lower()), None)
    if not treatment:
        raise HTTPException(status_code=404, detail=f"Treatment '{decoded_treatment}' not found in verification")
        
    analysis = analyze_treatment(treatment, db_verification.benefits)
    return analysis
