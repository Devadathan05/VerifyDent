import json
from typing import Dict, Any, List, Tuple
from app.providers.base import VerificationProvider, VerificationRequest, VerificationResult
from app.schemas.normalization import NormalizedBenefits, MappingTraceItem

class ProviderSimulatorA(VerificationProvider):
    provider_name = "provider_a"
    
    async def verify(self, request: VerificationRequest) -> VerificationResult:
        # Simulate different employer groups/plans using the same schema
        if request.subscriber_id == "PREMIUM":
            raw = {
                "subscriber_id": request.subscriber_id,
                "eligibility_status": "ACTIVE",
                "group": {
                    "number": "20002",
                    "name": "Globex Premium"
                },
                "plan": {
                    "name": "PPO Premium"
                },
                "annual_benefit_maximum": 2500,
                "benefits": {
                    "crowns": 80
                }
            }
        else:
            raw = {
                "subscriber_id": request.subscriber_id,
                "eligibility_status": "ACTIVE",
                "group": {
                    "number": "10001",
                    "name": "Acme Basic"
                },
                "plan": {
                    "name": "PPO Basic"
                },
                "annual_benefit_maximum": 1000,
                "benefits": {
                    "crowns": 50
                }
            }
            
        return VerificationResult(
            carrier_id=request.carrier_id,
            is_active=True,
            message="Success",
            raw_response=json.dumps(raw)
        )
        
    def normalize(self, raw_data: Dict[str, Any]) -> Tuple[NormalizedBenefits, List[MappingTraceItem]]:
        trace = []
        normalized = NormalizedBenefits(
            provider_source="ProviderSimulatorA",
            provider_environment="Production",
            provider_schema_version="v1"
        )
        
        if "subscriber_id" in raw_data:
            normalized.member_id = str(raw_data["subscriber_id"])
            normalized.subscriber_id = str(raw_data["subscriber_id"])
            trace.append(MappingTraceItem(provider="ProviderSimulatorA", schema_version="v1", source="subscriber_id", target="member_id", mapping_type="explicit"))
            trace.append(MappingTraceItem(provider="ProviderSimulatorA", schema_version="v1", source="subscriber_id", target="subscriber_id", mapping_type="explicit"))
            
        if "eligibility_status" in raw_data:
            val = str(raw_data["eligibility_status"]).upper()
            normalized.eligibility_status = val
            trace.append(MappingTraceItem(provider="ProviderSimulatorA", schema_version="v1", source="eligibility_status", target="eligibility_status", mapping_type="explicit"))
            
        group = raw_data.get("group")
        if isinstance(group, dict):
            if "number" in group:
                normalized.group_number = str(group["number"])
                trace.append(MappingTraceItem(provider="ProviderSimulatorA", schema_version="v1", source="group.number", target="group_number", mapping_type="explicit"))
            if "name" in group:
                normalized.group_name = str(group["name"])
                normalized.employer_name = str(group["name"])
                trace.append(MappingTraceItem(provider="ProviderSimulatorA", schema_version="v1", source="group.name", target="group_name", mapping_type="explicit"))
                
        plan = raw_data.get("plan")
        if isinstance(plan, dict) and "name" in plan:
            normalized.plan_name = str(plan["name"])
            trace.append(MappingTraceItem(provider="ProviderSimulatorA", schema_version="v1", source="plan.name", target="plan_name", mapping_type="explicit"))
            
        if "annual_benefit_maximum" in raw_data:
            normalized.annual_maximum = float(raw_data["annual_benefit_maximum"])
            trace.append(MappingTraceItem(provider="ProviderSimulatorA", schema_version="v1", source="annual_benefit_maximum", target="annual_maximum", mapping_type="explicit"))
            
        benefits = raw_data.get("benefits")
        if isinstance(benefits, dict) and "crowns" in benefits:
            from app.schemas.normalization import TreatmentBenefitBase
            normalized.treatment_benefits.append(TreatmentBenefitBase(
                treatment="Crown",
                covered=True,
                coverage_percentage=float(benefits["crowns"])
            ))
            trace.append(MappingTraceItem(provider="ProviderSimulatorA", schema_version="v1", source="benefits.crowns", target="treatment_benefits[Crown].coverage", mapping_type="explicit"))
            
        return normalized, trace

class ProviderSimulatorB(VerificationProvider):
    provider_name = "provider_b"
    
    async def verify(self, request: VerificationRequest) -> VerificationResult:
        raw = {
            "memberId": request.subscriber_id,
            "coverage": {
                "status": "ELIGIBLE"
            },
            "maximums": {
                "annual": 1500
            }
        }
        return VerificationResult(
            carrier_id=request.carrier_id,
            is_active=True,
            message="Success",
            raw_response=json.dumps(raw)
        )
        
    def normalize(self, raw_data: Dict[str, Any]) -> Tuple[NormalizedBenefits, List[MappingTraceItem]]:
        trace = []
        normalized = NormalizedBenefits()
        
        if "memberId" in raw_data:
            normalized.member_id = str(raw_data["memberId"])
            trace.append(MappingTraceItem(source="memberId", target="member_id"))
            
        coverage = raw_data.get("coverage")
        if isinstance(coverage, dict) and "status" in coverage:
            val = str(coverage["status"]).upper()
            if val == "ELIGIBLE":
                normalized.eligibility_status = "ACTIVE"
            else:
                normalized.eligibility_status = val
            trace.append(MappingTraceItem(source="coverage.status", target="eligibility_status"))
            
        maximums = raw_data.get("maximums")
        if isinstance(maximums, dict) and "annual" in maximums:
            normalized.annual_maximum = float(maximums["annual"])
            trace.append(MappingTraceItem(source="maximums.annual", target="annual_maximum"))
            
        return normalized, trace

class ProviderSimulatorC_V1(VerificationProvider):
    provider_name = "provider_c_v1"
    
    async def verify(self, request: VerificationRequest) -> VerificationResult:
        raw = {
            "subscriber_id": request.subscriber_id,
            "coverage_status": "ACTIVE",
            "benefit": {
                "annual_limit": 1800
            }
        }
        return VerificationResult(
            carrier_id=request.carrier_id,
            is_active=True,
            message="Success",
            raw_response=json.dumps(raw)
        )
        
    def normalize(self, raw_data: Dict[str, Any]) -> Tuple[NormalizedBenefits, List[MappingTraceItem]]:
        trace = []
        normalized = NormalizedBenefits(
            provider_source="ProviderSimulatorC",
            provider_schema_version="v1"
        )
        
        if "subscriber_id" in raw_data:
            normalized.member_id = str(raw_data["subscriber_id"])
            normalized.subscriber_id = str(raw_data["subscriber_id"])
            trace.append(MappingTraceItem(provider="ProviderSimulatorC", schema_version="v1", source="subscriber_id", target="member_id", mapping_type="explicit"))
            trace.append(MappingTraceItem(provider="ProviderSimulatorC", schema_version="v1", source="subscriber_id", target="subscriber_id", mapping_type="explicit"))
            
        if "coverage_status" in raw_data:
            val = str(raw_data["coverage_status"]).upper()
            normalized.eligibility_status = val
            trace.append(MappingTraceItem(provider="ProviderSimulatorC", schema_version="v1", source="coverage_status", target="eligibility_status", mapping_type="explicit"))
            
        benefit = raw_data.get("benefit")
        if isinstance(benefit, dict) and "annual_limit" in benefit:
            normalized.annual_maximum = float(benefit["annual_limit"])
            trace.append(MappingTraceItem(provider="ProviderSimulatorC", schema_version="v1", source="benefit.annual_limit", target="annual_maximum", mapping_type="explicit"))
            
        return normalized, trace

class ProviderSimulatorC_V2(VerificationProvider):
    provider_name = "provider_c_v2"
    
    async def verify(self, request: VerificationRequest) -> VerificationResult:
        raw = {
            "subscriber": {
                "identifier": request.subscriber_id
            },
            "status": "ACTIVE",
            "limits": {
                "yearly_max": 1800
            }
        }
        return VerificationResult(
            carrier_id=request.carrier_id,
            is_active=True,
            message="Success",
            raw_response=json.dumps(raw)
        )
        
    def normalize(self, raw_data: Dict[str, Any]) -> Tuple[NormalizedBenefits, List[MappingTraceItem]]:
        trace = []
        normalized = NormalizedBenefits(
            provider_source="ProviderSimulatorC",
            provider_schema_version="v2"
        )
        
        subscriber = raw_data.get("subscriber")
        if isinstance(subscriber, dict) and "identifier" in subscriber:
            normalized.member_id = str(subscriber["identifier"])
            normalized.subscriber_id = str(subscriber["identifier"])
            trace.append(MappingTraceItem(provider="ProviderSimulatorC", schema_version="v2", source="subscriber.identifier", target="member_id", mapping_type="explicit"))
            trace.append(MappingTraceItem(provider="ProviderSimulatorC", schema_version="v2", source="subscriber.identifier", target="subscriber_id", mapping_type="explicit"))
            
        if "status" in raw_data:
            val = str(raw_data["status"]).upper()
            normalized.eligibility_status = val
            trace.append(MappingTraceItem(provider="ProviderSimulatorC", schema_version="v2", source="status", target="eligibility_status", mapping_type="explicit"))
            
        limits = raw_data.get("limits")
        if isinstance(limits, dict) and "yearly_max" in limits:
            normalized.annual_maximum = float(limits["yearly_max"])
            trace.append(MappingTraceItem(provider="ProviderSimulatorC", schema_version="v2", source="limits.yearly_max", target="annual_maximum", mapping_type="explicit"))
            
        return normalized, trace

class ProviderSimulatorD(VerificationProvider):
    provider_name = "provider_d"
    
    async def verify(self, request: VerificationRequest) -> VerificationResult:
        raw = {
            "patient": {
                "id": request.subscriber_id
            },
            "coverage": {
                "active": True
            },
            "benefit_limits": {
                "annual": 2500
            }
        }
        return VerificationResult(
            carrier_id=request.carrier_id,
            is_active=True,
            message="Success",
            raw_response=json.dumps(raw)
        )
        
    def normalize(self, raw_data: Dict[str, Any]) -> Tuple[NormalizedBenefits, List[MappingTraceItem]]:
        trace = []
        normalized = NormalizedBenefits(
            provider_source="ProviderSimulatorD",
            provider_schema_version="v1"
        )
        
        patient = raw_data.get("patient")
        if isinstance(patient, dict) and "id" in patient:
            normalized.member_id = str(patient["id"])
            trace.append(MappingTraceItem(provider="ProviderSimulatorD", schema_version="v1", source="patient.id", target="member_id", mapping_type="explicit"))
            
        coverage = raw_data.get("coverage")
        if isinstance(coverage, dict) and "active" in coverage:
            is_active = coverage["active"]
            normalized.eligibility_status = "ACTIVE" if is_active else "INACTIVE"
            trace.append(MappingTraceItem(provider="ProviderSimulatorD", schema_version="v1", source="coverage.active", target="eligibility_status", mapping_type="explicit"))
            
        limits = raw_data.get("benefit_limits")
        if isinstance(limits, dict) and "annual" in limits:
            normalized.annual_maximum = float(limits["annual"])
            trace.append(MappingTraceItem(provider="ProviderSimulatorD", schema_version="v1", source="benefit_limits.annual", target="annual_maximum", mapping_type="explicit"))
            
        return normalized, trace
