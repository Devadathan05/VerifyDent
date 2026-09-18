"""Insurance provider integrations.

Real payer APIs (Delta Dental, Bupa, etc.) will be added later as
implementations of the Provider interface. Only scaffolding here for now.
"""

from abc import ABC, abstractmethod

from pydantic import BaseModel


class VerificationRequest(BaseModel):
    subscriber_id: str
    carrier_id: str
    plan_id: str | None = None


class VerificationResult(BaseModel):
    carrier_id: str
    is_active: bool
    message: str
    raw_response: str = "{}"


class VerificationProvider(ABC):
    """Interface every real/mock insurance provider implements."""

    @abstractmethod
    async def verify(self, request: VerificationRequest) -> VerificationResult:
        raise NotImplementedError