"""Tests for the insurance document upload + extraction endpoint."""

import glob
import os
import tempfile
from datetime import date

from PIL import Image

from app.services.document_extraction import (
    CorruptFileError,
    DocumentExtractionService,
    EmptyFileError,
    ExtractionUnavailableError,
    FileTooLargeError,
    InvalidFileTypeError,
    MockExtractor,
    UnavailableExtractor,
    detect_file_type,
)
from app.services.document_extraction.ocr import normalize_date

EXPECTED_FIELDS = {
    "first_name",
    "last_name",
    "date_of_birth",
    "member_id",
    "group_number",
    "policy_number",
    "payer_name",
    "subscriber_name",
    "relationship_to_subscriber",
}


def _png_bytes(png_path: bytes) -> bytes:
    return png_path


def _upload(client, content: bytes, filename: str):
    return client.post(
        "/api/insurance/upload",
        files={"file": (filename, content, "application/octet-stream")},
    )


# ---------------------------------------------------------------------------
# Valid uploads
# ---------------------------------------------------------------------------


def test_upload_valid_png(mock_client, sample_png_path):
    content = sample_png_path.read_bytes()
    response = _upload(mock_client, content, "sample_insurance_card.png")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "extracted"
    assert body["file_name"] == "sample_insurance_card.png"
    assert body["file_type"] == "png"
    assert body["provider"] == "mock"
    assert body["requires_confirmation"] is True
    assert set(body["fields"].keys()) == EXPECTED_FIELDS


def test_upload_valid_pdf(mock_client, sample_pdf_path):
    response = _upload(mock_client, sample_pdf_path.read_bytes(), "sample_insurance_card.pdf")

    assert response.status_code == 200
    body = response.json()
    assert body["file_type"] == "pdf"
    assert body["fields"]["member_id"]["value"] == "ABC123456"


def test_upload_valid_jpeg(mock_client, sample_png_path):
    tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
    tmp_name = tmp.name
    tmp.close()
    try:
        with Image.open(sample_png_path) as img:
            img.convert("RGB").save(tmp_name, "JPEG")
        with open(tmp_name, "rb") as handle:
            content = handle.read()
    finally:
        os.unlink(tmp_name)

    response = _upload(mock_client, content, "insurance_card.jpg")

    assert response.status_code == 200
    assert response.json()["file_type"] == "jpg"


# ---------------------------------------------------------------------------
# Invalid file types / sizes / corrupt / empty
# ---------------------------------------------------------------------------


def test_upload_invalid_file_type_rejected(mock_client):
    response = _upload(mock_client, b"plain text content", "notes.txt")
    assert response.status_code == 415
    assert "Unsupported file type" in response.json()["detail"]


def test_upload_oversized_rejected(tiny_limit_client):
    response = _upload(tiny_limit_client, b"x" * 10, "big.jpg")
    assert response.status_code == 413
    assert "maximum allowed" in response.json()["detail"]


def test_upload_corrupt_content_rejected(mock_client):
    response = _upload(mock_client, b"this is not a real image file", "card.png")
    assert response.status_code == 422


def test_upload_extension_content_mismatch_rejected(mock_client, sample_png_path):
    png = sample_png_path.read_bytes()
    response = _upload(mock_client, png, "disguised.pdf")
    assert response.status_code == 422
    assert "does not match" in response.json()["detail"]


def test_upload_empty_file_rejected(mock_client):
    response = _upload(mock_client, b"", "card.png")
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Extraction response schema / null fields
# ---------------------------------------------------------------------------


def test_extraction_schema_field_shape(mock_client, sample_png_path):
    body = _upload(mock_client, sample_png_path.read_bytes(), "card.png").json()
    for field, spec in body["fields"].items():
        assert set(spec.keys()) == {"value", "confidence"}
        assert spec["confidence"] is None or 0.0 <= spec["confidence"] <= 1.0


def test_missing_policy_number_returns_null(mock_client, sample_png_path):
    body = _upload(mock_client, sample_png_path.read_bytes(), "card.png").json()
    assert body["fields"]["policy_number"] == {"value": None, "confidence": None}


def test_mock_extraction_contains_fictional_values(mock_client, sample_png_path):
    body = _upload(mock_client, sample_png_path.read_bytes(), "card.png").json()
    fields = body["fields"]
    assert fields["first_name"]["value"] == "Emily"
    assert fields["last_name"]["value"] == "Carter"
    assert fields["date_of_birth"]["value"] == "1993-07-22"
    assert fields["payer_name"]["value"] == "Delta Dental of California"


def test_auto_fallback_never_returns_fictional_details(sample_png_path):
    service = DocumentExtractionService(UnavailableExtractor(), max_size_bytes=10_000_000)

    import pytest

    with pytest.raises(ExtractionUnavailableError):
        service.extract("card.png", sample_png_path.read_bytes())


# ---------------------------------------------------------------------------
# Temporary file cleanup
# ---------------------------------------------------------------------------


def _leftover_temp_files():
    return glob.glob(os.path.join(tempfile.gettempdir(), "verifydent_*"))


def test_temporary_files_are_cleaned_up(mock_client, sample_png_path):
    before = len(_leftover_temp_files())
    assert _upload(mock_client, sample_png_path.read_bytes(), "card.png").status_code == 200
    after = len(_leftover_temp_files())
    assert after == before


def test_temporary_files_cleaned_up_on_failure(mock_client):
    before = len(_leftover_temp_files())
    assert _upload(mock_client, b"x" * 5, "card.png").status_code == 422
    assert len(_leftover_temp_files()) == before


def test_service_temporary_file_cleanup_with_mock():
    service = DocumentExtractionService(MockExtractor(), max_size_bytes=10_000_000)
    result = service.extract("card.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
    assert result["provider"] == "mock"
    assert not _leftover_temp_files()


# ---------------------------------------------------------------------------
# Unit-level: validation + date normalization
# ---------------------------------------------------------------------------


def test_detect_file_type_accepts_all_extensions():
    pdf = b"%PDF-1.4 fake"
    png = b"\x89PNG\r\n\x1a\nfake"
    jpg = b"\xff\xd8\xff fake"
    assert detect_file_type("a.pdf", pdf) == "pdf"
    assert detect_file_type("a.png", png) == "png"
    assert detect_file_type("a.jpg", jpg) == "jpg"
    assert detect_file_type("a.jpeg", jpg) == "jpeg"


def test_detect_file_type_raises_typed_errors():
    import pytest

    with pytest.raises(InvalidFileTypeError):
        detect_file_type("a.exe", b"MZ fake")
    with pytest.raises(CorruptFileError):
        detect_file_type("a.png", b"not a real png")
    with pytest.raises(CorruptFileError):
        detect_file_type("a.pdf", b"\x89PNG\r\n\x1a\npngbytes")


def test_service_raises_typed_errors():
    import pytest

    service = DocumentExtractionService(MockExtractor(), max_size_bytes=1024)
    with pytest.raises(EmptyFileError):
        service.extract("a.pdf", b"")
    with pytest.raises(FileTooLargeError):
        service.extract("a.png", b"\x89PNG\r\n\x1a\n" + b"x" * 2048)


def test_normalize_date_formats():
    assert normalize_date("07/22/1993") == "1993-07-22"
    assert normalize_date("07-22-1993") == "1993-07-22"
    assert normalize_date("7/22/1993") == "1993-07-22"
    assert normalize_date("1993-07-22") == "1993-07-22"
    assert normalize_date("2026/01/01") == "2026-01-01"
    assert normalize_date("May 14, 1988") == "1988-05-14"
    assert normalize_date("Jan 05 1990") == "1990-01-05"
    assert normalize_date("not a date") is None
    assert normalize_date("") is None


def test_normalize_date_returns_date_type_value(mock_client, sample_png_path):
    body = _upload(mock_client, sample_png_path.read_bytes(), "card.png").json()
    dob = body["fields"]["date_of_birth"]["value"]
    # Must be ISO YYYY-MM-DD.
    parsed = date.fromisoformat(dob)
    assert parsed.year == 1993


# ---------------------------------------------------------------------------
# Real OCR path (skipped when Tesseract is unavailable)
# ---------------------------------------------------------------------------

import pytest

from app.services.document_extraction.ocr import TesseractExtractor


@pytest.mark.skipif(
    not TesseractExtractor.available(),
    reason="Tesseract binary not available on this machine",
)
def test_ocr_provider_extracts_sample_card(ocr_client, sample_png_path):
    response = _upload(ocr_client, sample_png_path.read_bytes(), "sample_insurance_card.png")
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "tesseract-ocr"
    assert body["raw_text"].strip()
    assert "DELTA DENTAL" in body["raw_text"].upper()


@pytest.mark.skipif(
    not TesseractExtractor.available(),
    reason="Tesseract binary not available on this machine",
)
def test_ocr_provider_extracts_sample_pdf(ocr_client, sample_pdf_path):
    response = _upload(ocr_client, sample_pdf_path.read_bytes(), "sample_insurance_card.pdf")
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "tesseract-ocr"
    assert body["raw_text"].strip()