"""Registry for looking up insurance providers."""

from .base import VerificationProvider
from .mock_provider import MockVerificationProvider
from .simulators import ProviderSimulatorA, ProviderSimulatorB, ProviderSimulatorC_V1, ProviderSimulatorC_V2, ProviderSimulatorD

class ProviderRegistry:
    def __init__(self):
        self._mock_provider = MockVerificationProvider()
        self._simulators = {
            "provider_a": ProviderSimulatorA(),
            "provider_b": ProviderSimulatorB(),
            "provider_c_v1": ProviderSimulatorC_V1(),
            "provider_c_v2": ProviderSimulatorC_V2(),
            "provider_d": ProviderSimulatorD()
        }

    def get_provider(self, payer_name: str) -> VerificationProvider | None:
        """
        Returns the appropriate provider for the given normalized payer.
        If the payer_name matches one of the demo simulator keys, returns it.
        Otherwise, for the MVP, returns the mock provider.
        Returns None for unknown payers.
        """
        if payer_name == "UNKNOWN" or not payer_name:
            return None
            
        payer_lower = payer_name.lower()
        if payer_lower in self._simulators:
            return self._simulators[payer_lower]
            
        return self._mock_provider

def get_provider_registry() -> ProviderRegistry:
    return ProviderRegistry()
