"""Mock extraction provider used when OCR is not available or not wanted.

The mock adapter simulates extraction from a *fictional* sample insurance card
(see ``tests/fixtures/sample_insurance_card.png``). It always returns the same
fictional dataset so demos and tests are deterministic.

It is a first-class ``DocumentExtractor`` implementation: a future cloud OCR
provider can be swapped in here without touching the route or the service.
Real patient data is NEVER used here.
"""

from .base import DocumentExtractor, ExtractedValue, InsuranceExtraction

# Fully fictional sample values — matches tests/fixtures/sample_insurance_card.*
MOCK_FIELDS = {
    "first_name": ExtractedValue(value="Emily", confidence=0.99),
    "last_name": ExtractedValue(value="Carter", confidence=0.99),
    "date_of_birth": ExtractedValue(value="1993-07-22", confidence=0.97),
    "member_id": ExtractedValue(value="ABC123456", confidence=0.98),
    "group_number": ExtractedValue(value="G-8712", confidence=0.96),
    # Insurance cards do not print a policy number; we never invent one.
    "policy_number": ExtractedValue(value=None, confidence=None),
    "payer_name": ExtractedValue(value="Delta Dental of California", confidence=0.98),
    "subscriber_name": ExtractedValue(value="Emily Carter", confidence=0.99),
    # No relationship label on the card; assume self, low confidence.
    "relationship_to_subscriber": ExtractedValue(value="Self", confidence=0.6),
}


class MockExtractor(DocumentExtractor):
    """Deterministic extractor for the fictional sample insurance card."""

    provider_name = "mock"

    def extract(self, file_path: str, file_type: str) -> InsuranceExtraction:
        return InsuranceExtraction.model_validate(MOCK_FIELDS)


__all__ = ["MockExtractor", "MOCK_FIELDS"]