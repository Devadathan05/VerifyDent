"""Document extraction service.

Orchestration only — this module:

* validates the uploaded document (type, size, emptiness, magic bytes),
* stores it in a temporary file for processing,
* asks the configured ``DocumentExtractor`` to extract structured fields,
* deletes the temporary file (always, even on error).

No database, no verification logic. The produced ``InsuranceExtraction`` is the
hand-off payload for the next stage (payer identification + eligibility check).
"""

from __future__ import annotations

import tempfile
import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

from app.core.config import Settings, get_settings

from .base import (
    CorruptFileError,
    DocumentExtractionError,
    DocumentExtractor,
    EmptyFileError,
    ExtractionFailedError,
    ExtractionUnavailableError,
    FileTooLargeError,
    InsuranceExtraction,
    InvalidFileTypeError,
)

ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg"}

# Maps file category -> expected leading magic bytes.
_MAGIC_BYTES = {
    "pdf": b"%PDF",
    "png": b"\x89PNG\r\n\x1a\n",
    "jpg": b"\xff\xd8\xff",
    "jpeg": b"\xff\xd8\xff",
}


def detect_file_type(filename: str, content: bytes) -> str:
    """Return the validated file category or raise ``DocumentExtractionError``.

    We check both the declared extension and the actual leading bytes so a
    renamed file cannot slip through the validation.
    """
    ext = Path(filename).suffix.lower().lstrip(".")
    if ext not in ALLOWED_EXTENSIONS:
        raise InvalidFileTypeError(
            f"Unsupported file type '{ext or 'unknown'}'. "
            f"Accepted types: {', '.join(sorted(ALLOWED_EXTENSIONS))}."
        )

    actual = _magic_type(content)
    if actual is None:
        raise CorruptFileError(
            "File appears to be empty or corrupt (no recognized file signature)."
        )
    jpeg_aliases = {actual, ext} == {"jpg", "jpeg"}
    if actual != ext and not jpeg_aliases:
        raise CorruptFileError(
            f"File content does not match its '.{ext}' extension (detected {actual})."
        )
    return ext


def _magic_type(content: bytes) -> Optional[str]:
    for category, magic in _MAGIC_BYTES.items():
        if content[: len(magic)] == magic:
            return category
    return None


class DocumentExtractionService:
    """Validates and extracts insurance fields from uploaded documents."""

    def __init__(self, extractor: DocumentExtractor, max_size_bytes: int) -> None:
        self.extractor = extractor
        self.max_size_bytes = max_size_bytes

    def extract(self, filename: str, content: bytes) -> dict:
        """Validate -> temp store -> extract -> cleanup.

        Returns the structured extraction result plus processing metadata.
        The temporary file is always removed.
        """
        if not content:
            raise EmptyFileError("Uploaded file is empty.")

        if len(content) > self.max_size_bytes:
            raise FileTooLargeError(
                f"File is {len(content)} bytes; maximum allowed is "
                f"{self.max_size_bytes} bytes ({self.max_size_bytes // (1024 * 1024)} MB)."
            )

        file_type = detect_file_type(filename, content)

        fd, tmp_path = tempfile.mkstemp(suffix=f".{file_type}", prefix="verifydent_")
        try:
            with os.fdopen(fd, "wb") as handle:
                handle.write(content)

            try:
                extraction = self.extractor.extract(tmp_path, file_type)
            except ExtractionUnavailableError:
                raise
            except DocumentExtractionError as exc:
                raise ExtractionFailedError(str(exc)) from exc
            except Exception as exc:
                raise ExtractionFailedError(f"Extraction failed: {exc}") from exc
        finally:
            try:
                os.remove(tmp_path)
            except OSError:
                pass

        return {
            "file_name": Path(filename).name,
            "file_type": file_type,
            "provider": self.extractor.provider_name,
            "raw_text": extraction.raw_text,
            "fields": extraction.model_dump(exclude={"raw_text"}),
        }


# ---------------------------------------------------------------------------
# Provider selection and FastAPI dependency.
# ---------------------------------------------------------------------------


def build_extractor(settings: Optional[Settings] = None) -> DocumentExtractor:
    """Pick the extraction provider:

    * ``EXTRACTION_PROVIDER=ocr``  -> Tesseract OCR (errors if unavailable)
    * ``EXTRACTION_PROVIDER=mock`` -> deterministic fictional mock
    * ``EXTRACTION_PROVIDER=auto`` -> OCR when available, otherwise unavailable
    """
    settings = settings or get_settings()
    provider = settings.extraction_provider

    if provider == "ocr":
        from .ocr import TesseractExtractor

        if not TesseractExtractor.available():
            raise DocumentExtractionError(
                "EXTRACTION_PROVIDER=ocr but the Tesseract binary is not available."
            )
        return TesseractExtractor(settings)

    if provider == "mock":
        from .mock import MockExtractor

        return MockExtractor()

    # auto (default)
    from .ocr import TesseractExtractor

    if TesseractExtractor.available(settings.tesseract_cmd):
        return TesseractExtractor(settings)

    return UnavailableExtractor()


class UnavailableExtractor(DocumentExtractor):
    """Provider used when auto mode has no real OCR engine available."""

    provider_name = "unavailable"

    def extract(self, file_path: str, file_type: str) -> InsuranceExtraction:
        raise ExtractionUnavailableError(
            "No OCR provider is available. Install Tesseract or set "
            "EXTRACTION_PROVIDER=mock for fictional demo data."
        )


@lru_cache(maxsize=1)
def get_default_extractor() -> DocumentExtractor:
    return build_extractor()


def get_document_extractor() -> DocumentExtractor:
    """FastAPI dependency that resolves the configured extraction provider."""
    return get_default_extractor()


def get_document_extraction_service(extractor: DocumentExtractor) -> DocumentExtractionService:
    """Build the service bound to a given extractor (used with override in tests)."""
    settings = get_settings()
    return DocumentExtractionService(extractor, settings.max_upload_size_mb * 1024 * 1024)


__all__ = [
    "ALLOWED_EXTENSIONS",
    "CorruptFileError",
    "DocumentExtractionError",
    "DocumentExtractionService",
    "EmptyFileError",
    "ExtractionFailedError",
    "FileTooLargeError",
    "InvalidFileTypeError",
    "build_extractor",
    "detect_file_type",
    "get_default_extractor",
    "get_document_extractor",
    "get_document_extraction_service",
]