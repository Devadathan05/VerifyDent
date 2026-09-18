import sys
import os
from pathlib import Path

# Add the backend directory to sys.path so we can import app modules
backend_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(backend_dir))

from datetime import date
from sqlalchemy.orm import Session
from app.db.session import engine, Base, SessionLocal
from app.models import Patient, InsurancePolicy

def init_db():
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created.")

def seed_db():
    db: Session = SessionLocal()
    try:
        if db.query(Patient).first():
            print("Database already seeded. Skipping.")
            return

        print("Seeding patients and policies...")

        p1 = Patient(
            first_name="John",
            last_name="Doe",
            date_of_birth=date(1980, 1, 1)
        )
        p2 = Patient(
            first_name="Jane",
            last_name="Smith",
            date_of_birth=date(1992, 5, 15)
        )
        p3 = Patient(
            first_name="Michael",
            last_name="Johnson",
            date_of_birth=date(1975, 11, 30)
        )

        db.add_all([p1, p2, p3])
        db.commit()

        pol1 = InsurancePolicy(
            patient_id=p1.id,
            payer_name="Delta Dental",
            member_id="DD123456789",
            group_number="GRP100",
            subscriber_name="John Doe",
            relationship_to_subscriber="Self"
        )
        
        pol2 = InsurancePolicy(
            patient_id=p2.id,
            payer_name="MetLife",
            member_id="ML987654321",
            subscriber_name="Jane Smith",
            relationship_to_subscriber="Self"
        )

        pol3 = InsurancePolicy(
            patient_id=p3.id,
            payer_name="Cigna",
            member_id="CG555666777",
            group_number="CIG-200",
            subscriber_name="Mary Johnson",
            relationship_to_subscriber="Spouse"
        )

        db.add_all([pol1, pol2, pol3])
        db.commit()

        print("Database seeded successfully.")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
    seed_db()
