"""Registry for looking up insurance providers."""

from .base import VerificationProvider
from .mock_provider import MockVerificationProvider

class ProviderRegistry:
    def __init__(self):
        self._mock_provider = MockVerificationProvider()

    def get_provider(self, payer_name: str) -> VerificationProvider | None:
        """
        Returns the appropriate provider for the given normalized payer.
        For the MVP, we return the mock provider for all known payers.
        Returns None for unknown payers.
        """
        if payer_name == "UNKNOWN" or not payer_name:
            return None
            
        return self._mock_provider

def get_provider_registry() -> ProviderRegistry:
    return ProviderRegistry()
