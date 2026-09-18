"""Aggregate all API routers under the /api prefix."""

from fastapi import APIRouter

from app.api.routes.health import router as health_router
from app.api.routes.patients import router as patients_router
from app.api.routes.insurance import policies_router, verifications_router
from app.api.routes.extraction import router as extraction_router
from app.api.routes.normalization import router as normalization_router
from app.api.routes.appointments import router as appointments_router

api_router = APIRouter(prefix="/api")
api_router.include_router(health_router)
api_router.include_router(patients_router, prefix="/patients", tags=["patients"])
api_router.include_router(policies_router, prefix="/insurance/policies", tags=["insurance"])
api_router.include_router(verifications_router, prefix="/verifications", tags=["verifications"])
api_router.include_router(extraction_router, prefix="/insurance", tags=["insurance-documents"])
api_router.include_router(normalization_router, prefix="/normalization", tags=["normalization"])
api_router.include_router(appointments_router, prefix="/appointments", tags=["appointments"])