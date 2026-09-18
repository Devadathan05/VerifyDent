"""Aggregate all API routers under the /api prefix."""

from fastapi import APIRouter

from app.api.routes.health import router as health_router

api_router = APIRouter(prefix="/api")
api_router.include_router(health_router)