"""Document extraction abstraction.

Defines the *Structured Extraction Result* and the contract every
extraction provider (real OCR, mock, future cloud OCR) must satisfy.

This module has no knowledge of the database, insurance verification,
or payer integrations — it only turns a document into structured data.
"""

from abc import ABC, abstractmethod
from typing import Dict, Optional

from pydantic import BaseModel, Field


class DocumentExtractionError(Exception):
    """Base class for document validation/extraction failures."""


class EmptyFileError(DocumentExtractionError):
    """Uploaded content was zero bytes."""


class InvalidFileTypeError(DocumentExtractionError):
    """Extension or magic bytes do not match an accepted document type."""


class FileTooLargeError(DocumentExtractionError):
    """Uploaded document exceeds the configured size limit."""


class CorruptFileError(DocumentExtractionError):
    """File has an accepted extension but no recognizable content signature."""


class ExtractionFailedError(DocumentExtractionError):
    """Document was valid but the extraction provider could not process it."""


class ExtractionUnavailableError(DocumentExtractionError):
    """No real document extraction provider is available."""


class ExtractedValue(BaseModel):
    """A single extracted field with optional confidence.

    ``value`` is ``None`` when the field could not be reliably extracted.
    ``confidence`` is a float in ``[0, 1]`` when the provider supports it,
    otherwise ``None``.
    """

    value: Optional[str] = None
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class InsuranceExtraction(BaseModel):
    """Structured fields extracted from an insurance card / PDF.

    Field names intentionally match the health domain vocabulary used
    elsewhere in the project (``InsurancePolicy`` columns).
    """

    first_name: ExtractedValue = ExtractedValue()
    last_name: ExtractedValue = ExtractedValue()
    date_of_birth: ExtractedValue = ExtractedValue()
    member_id: ExtractedValue = ExtractedValue()
    group_number: ExtractedValue = ExtractedValue()
    policy_number: ExtractedValue = ExtractedValue()
    payer_name: ExtractedValue = ExtractedValue()
    subscriber_name: ExtractedValue = ExtractedValue()
    relationship_to_subscriber: ExtractedValue = ExtractedValue()
    raw_text: str = ""


class DocumentExtractor(ABC):
    """Interface every extraction provider implements.

    A provider receives an already-validated document stored at a local
    temporary path and returns a structured ``InsuranceExtraction``.
    """

    #: Human-readable name reported in API responses, e.g. "tesseract-ocr".
    provider_name: str = "base"

    @abstractmethod
    def extract(self, file_path: str, file_type: str) -> InsuranceExtraction:
        """Extract insurance fields from ``file_path``.

        ``file_type`` is the validated file category: ``pdf``, ``png``,
        ``jpg`` or ``jpeg``.
        """
        raise NotImplementedError


def fields_mapping(extraction: InsuranceExtraction) -> Dict[str, ExtractedValue]:
    """Return the field name -> value mapping (used for flat responses)."""
    return extraction.model_dump()


__all__ = [
    "DocumentExtractionError",
    "EmptyFileError",
    "InvalidFileTypeError",
    "FileTooLargeError",
    "CorruptFileError",
    "ExtractionFailedError",
    "ExtractedValue",
    "InsuranceExtraction",
    "DocumentExtractor",
    "fields_mapping",
]