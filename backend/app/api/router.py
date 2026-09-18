"""Aggregate all API routers under the /api prefix."""

from fastapi import APIRouter

from app.api.routes.health import router as health_router
from app.api.routes.patients import router as patients_router
from app.api.routes.insurance import policies_router, verifications_router

api_router = APIRouter(prefix="/api")
api_router.include_router(health_router)
api_router.include_router(patients_router, prefix="/patients", tags=["patients"])
api_router.include_router(policies_router, prefix="/insurance/policies", tags=["insurance"])
api_router.include_router(verifications_router, prefix="/verifications", tags=["verifications"])