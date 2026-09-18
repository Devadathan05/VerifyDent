import json
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any

from app.providers.registry import ProviderRegistry, get_provider_registry
from app.providers.base import VerificationRequest
from app.schemas.normalization import NormalizationDemoResponse

router = APIRouter()

class DemoRequest(BaseModel):
    provider_name: str
    subscriber_id: str = "DEMO12345"

@router.post("/demo", response_model=NormalizationDemoResponse)
async def normalization_demo(
    payload: DemoRequest,
    registry: ProviderRegistry = Depends(get_provider_registry)
):
    provider = registry.get_provider(payload.provider_name)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
        
    # We expect these simulators to have a normalize method
    if not hasattr(provider, "normalize"):
        raise HTTPException(status_code=400, detail="Selected provider does not support explicit normalization demo")
        
    req = VerificationRequest(
        subscriber_id=payload.subscriber_id,
        carrier_id="DEMO_CARRIER"
    )
    
    result = await provider.verify(req)
    raw_data = json.loads(result.raw_response)
    
    normalized, trace = provider.normalize(raw_data)
    
    return NormalizationDemoResponse(
        provider=provider.provider_name,
        raw_response=raw_data,
        normalized=normalized,
        mapping_trace=trace
    )
