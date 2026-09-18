from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.models import Patient as PatientModel
from app.schemas import Patient, PatientCreate

router = APIRouter()

@router.post("/", response_model=Patient, status_code=status.HTTP_201_CREATED)
def create_patient(patient_in: PatientCreate, db: Session = Depends(get_db)):
    db_patient = PatientModel(**patient_in.model_dump())
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    return db_patient

@router.get("/", response_model=List[Patient])
def get_patients(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    stmt = select(PatientModel).offset(skip).limit(limit)
    patients = db.execute(stmt).scalars().all()
    return list(patients)

@router.get("/{patient_id}", response_model=Patient)
def get_patient(patient_id: UUID, db: Session = Depends(get_db)):
    db_patient = db.get(PatientModel, patient_id)
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return db_patient
