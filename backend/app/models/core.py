import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import String, ForeignKey, Date, DateTime, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.session import Base

class Patient(Base):
    __tablename__ = "patients"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    first_name: Mapped[str] = mapped_column(String(50))
    last_name: Mapped[str] = mapped_column(String(50))
    date_of_birth: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    appointments: Mapped[List["Appointment"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    policies: Mapped[List["InsurancePolicy"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    verifications: Mapped[List["InsuranceVerification"]] = relationship(back_populates="patient", cascade="all, delete-orphan")

class Appointment(Base):
    __tablename__ = "appointments"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    insurance_verification_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("insurance_verifications.id"), nullable=True)
    appointment_date: Mapped[date] = mapped_column(Date)
    appointment_time: Mapped[str] = mapped_column(String(50))
    appointment_type: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(50), default="SCHEDULED")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    patient: Mapped["Patient"] = relationship(back_populates="appointments")
    verification: Mapped[Optional["InsuranceVerification"]] = relationship(back_populates="appointments")

class InsurancePolicy(Base):
    __tablename__ = "insurance_policies"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    payer_name: Mapped[str] = mapped_column(String(100), index=True)
    member_id: Mapped[str] = mapped_column(String(50), index=True)
    group_number: Mapped[Optional[str]] = mapped_column(String(50))
    policy_number: Mapped[Optional[str]] = mapped_column(String(50))
    subscriber_name: Mapped[Optional[str]] = mapped_column(String(100))
    relationship_to_subscriber: Mapped[Optional[str]] = mapped_column(String(50))
    effective_date: Mapped[Optional[date]] = mapped_column(Date)
    termination_date: Mapped[Optional[date]] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    patient: Mapped["Patient"] = relationship(back_populates="policies")
    verifications: Mapped[List["InsuranceVerification"]] = relationship(back_populates="policy", cascade="all, delete-orphan")

class InsuranceVerification(Base):
    __tablename__ = "insurance_verifications"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    insurance_policy_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("insurance_policies.id"), index=True)
    status: Mapped[str] = mapped_column(String(50), index=True, default="pending")
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    verification_source: Mapped[Optional[str]] = mapped_column(String(100))
    verification_reference: Mapped[Optional[str]] = mapped_column(String(100))
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    appointments: Mapped[List["Appointment"]] = relationship(back_populates="verification")
    patient: Mapped["Patient"] = relationship(back_populates="verifications")
    policy: Mapped["InsurancePolicy"] = relationship(back_populates="verifications")
    payer_responses: Mapped[List["PayerResponse"]] = relationship(back_populates="verification", cascade="all, delete-orphan")
    benefits: Mapped[Optional["InsuranceBenefits"]] = relationship(back_populates="verification", cascade="all, delete-orphan")
    limitations: Mapped[List["BenefitLimitation"]] = relationship(back_populates="verification", cascade="all, delete-orphan")
    events: Mapped[List["VerificationEvent"]] = relationship(back_populates="verification", cascade="all, delete-orphan")
    treatment_benefits: Mapped[List["TreatmentBenefit"]] = relationship(back_populates="verification", cascade="all, delete-orphan")

class PayerResponse(Base):
    __tablename__ = "payer_responses"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    verification_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("insurance_verifications.id"), index=True)
    source: Mapped[str] = mapped_column(String(100))
    response_format: Mapped[str] = mapped_column(String(50))
    raw_response: Mapped[str] = mapped_column(Text)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    verification: Mapped["InsuranceVerification"] = relationship(back_populates="payer_responses")

class InsuranceBenefits(Base):
    __tablename__ = "insurance_benefits"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    verification_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("insurance_verifications.id"), unique=True)
    annual_maximum: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    annual_maximum_remaining: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    deductible: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    deductible_remaining: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    preventive_coverage: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2)) # Percentage
    basic_coverage: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    major_coverage: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    verification: Mapped["InsuranceVerification"] = relationship(back_populates="benefits")

class BenefitLimitation(Base):
    __tablename__ = "benefit_limitations"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    verification_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("insurance_verifications.id"), index=True)
    procedure_code: Mapped[str] = mapped_column(String(20))
    procedure_name: Mapped[Optional[str]] = mapped_column(String(255))
    limitation_type: Mapped[str] = mapped_column(String(50))
    limitation_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    limitation_unit: Mapped[Optional[str]] = mapped_column(String(20))
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    verification: Mapped["InsuranceVerification"] = relationship(back_populates="limitations")

class VerificationEvent(Base):
    __tablename__ = "verification_events"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    verification_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("insurance_verifications.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(50))
    message: Mapped[Optional[str]] = mapped_column(Text)
    source: Mapped[Optional[str]] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    verification: Mapped["InsuranceVerification"] = relationship(back_populates="events")

class TreatmentBenefit(Base):
    __tablename__ = "treatment_benefits"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    verification_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("insurance_verifications.id"), index=True)
    treatment: Mapped[str] = mapped_column(String(100))
    covered: Mapped[bool] = mapped_column()
    coverage_percentage: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    waiting_period: Mapped[Optional[str]] = mapped_column(String(100))
    frequency: Mapped[Optional[str]] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    verification: Mapped["InsuranceVerification"] = relationship(back_populates="treatment_benefits")
