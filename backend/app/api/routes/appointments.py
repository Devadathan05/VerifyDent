from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.models.core import Appointment as DBAppointment, Patient as DBPatient, InsuranceVerification as DBVerification
from app.schemas.core import Appointment, AppointmentCreate, AppointmentUpdate, PatientCreate

router = APIRouter()

class AppointmentPayload(AppointmentCreate):
    patient: PatientCreate

@router.post("/", response_model=Appointment)
def create_appointment(
    payload: AppointmentPayload,
    db: Session = Depends(get_db)
):
    # For the hackathon, we'll try to find the patient by name and DOB, or create them.
    # In a real system, you'd match by more robust criteria or they'd select an existing patient.
    stmt = select(DBPatient).where(
        DBPatient.first_name == payload.patient.first_name,
        DBPatient.last_name == payload.patient.last_name,
        DBPatient.date_of_birth == payload.patient.date_of_birth
    )
    db_patient = db.execute(stmt).scalar_one_or_none()
    
    if not db_patient:
        db_patient = DBPatient(**payload.patient.model_dump())
        db.add(db_patient)
        db.commit()
        db.refresh(db_patient)

    db_appointment = DBAppointment(
        patient_id=db_patient.id,
        appointment_date=payload.appointment_date,
        appointment_time=payload.appointment_time,
        appointment_type=payload.appointment_type,
        status=payload.status
    )
    db.add(db_appointment)
    db.commit()
    db.refresh(db_appointment)
    
    return db_appointment

@router.get("/", response_model=List[dict])
def list_appointments(db: Session = Depends(get_db)):
    # Include patient data to easily show it in the UI dashboard
    stmt = select(DBAppointment, DBPatient).join(DBPatient, DBAppointment.patient_id == DBPatient.id).order_by(DBAppointment.appointment_date.desc(), DBAppointment.appointment_time.desc())
    results = db.execute(stmt).all()
    
    response = []
    for appt, pat in results:
        insurance_status = "Not verified"
        if appt.insurance_verification_id:
            ver = db.execute(select(DBVerification).where(DBVerification.id == appt.insurance_verification_id)).scalar_one_or_none()
            if ver:
                if ver.status == "VERIFIED":
                    insurance_status = "Verified — Active"
                elif ver.status == "FAILED":
                    insurance_status = "Verification Failed"
                else:
                    insurance_status = "Pending Verification"
        
        response.append({
            "id": appt.id,
            "patient_name": f"{pat.first_name} {pat.last_name}",
            "appointment_date": appt.appointment_date,
            "appointment_time": appt.appointment_time,
            "appointment_type": appt.appointment_type,
            "status": appt.status,
            "insurance_status": insurance_status
        })
    return response

@router.get("/{appointment_id}")
def get_appointment(appointment_id: UUID, db: Session = Depends(get_db)):
    stmt = select(DBAppointment, DBPatient).join(DBPatient, DBAppointment.patient_id == DBPatient.id).where(DBAppointment.id == appointment_id)
    result = db.execute(stmt).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Appointment not found")
        
    appt, pat = result
    
    verification_data = None
    if appt.insurance_verification_id:
        # fetch verification details if they exist
        from app.api.routes.insurance import get_verification
        try:
            verification_data = get_verification(appt.insurance_verification_id, db)
        except HTTPException:
            pass # ignore if not found

    return {
        "appointment": appt,
        "patient": pat,
        "verification": verification_data
    }

@router.patch("/{appointment_id}", response_model=Appointment)
def update_appointment(appointment_id: UUID, update_data: AppointmentUpdate, db: Session = Depends(get_db)):
    stmt = select(DBAppointment).where(DBAppointment.id == appointment_id)
    db_appointment = db.execute(stmt).scalar_one_or_none()
    
    if not db_appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
        
    if update_data.status is not None:
        db_appointment.status = update_data.status
        
    if update_data.insurance_verification_id is not None:
        db_appointment.insurance_verification_id = update_data.insurance_verification_id
        
    db.commit()
    db.refresh(db_appointment)
    return db_appointment
