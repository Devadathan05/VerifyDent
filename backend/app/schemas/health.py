"""API schemas (Pydantic models) for request/response validation."""

from datetime import datetime

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    app: str
    environment: str
    version: str
    timestamp: datetime