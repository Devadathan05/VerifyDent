"""Document extraction package.

Layers, kept strictly separate (see README):

Document Upload -> Document Extraction -> Structured Extraction Result

* ``base.py``   — ``DocumentExtractor`` abstraction + result models
* ``ocr.py``    — real Tesseract OCR implementation
* ``mock.py``   — deterministic fictional mock adapter
* ``service.py``— validation, temp storage, cleanup, provider selection
"""

from .base import (
    CorruptFileError,
    DocumentExtractionError,
    DocumentExtractor,
    EmptyFileError,
    ExtractionFailedError,
    ExtractionUnavailableError,
    ExtractedValue,
    FileTooLargeError,
    InsuranceExtraction,
    InvalidFileTypeError,
)
from .mock import MockExtractor
from .service import (
    DocumentExtractionService,
    UnavailableExtractor,
    build_extractor,
    detect_file_type,
    get_default_extractor,
    get_document_extractor,
    get_document_extraction_service,
)

__all__ = [
    "CorruptFileError",
    "DocumentExtractionError",
    "DocumentExtractor",
    "DocumentExtractionService",
    "EmptyFileError",
    "ExtractionFailedError",
    "ExtractionUnavailableError",
    "ExtractedValue",
    "FileTooLargeError",
    "InsuranceExtraction",
    "InvalidFileTypeError",
    "MockExtractor",
    "build_extractor",
    "detect_file_type",
    "get_default_extractor",
    "get_document_extractor",
    "get_document_extraction_service",
    "UnavailableExtractor",
]