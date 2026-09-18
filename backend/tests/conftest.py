"""Shared fixtures for backend tests."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.routes.extraction import get_service as extraction_get_service
from app.main import app
from app.services.document_extraction import (
    DocumentExtractionService,
    MockExtractor,
    build_extractor,
    get_document_extractor,
)

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="session", autouse=True)
def _regenerate_fixtures():
    if not (FIXTURES_DIR / "sample_insurance_card.png").exists():
        from scripts.make_sample_card import save_fixtures

        save_fixtures(FIXTURES_DIR)


@pytest.fixture()
def sample_png_path() -> Path:
    return FIXTURES_DIR / "sample_insurance_card.png"


@pytest.fixture()
def sample_pdf_path() -> Path:
    return FIXTURES_DIR / "sample_insurance_card.pdf"


@pytest.fixture()
def mock_client():
    """Client whose extraction provider is the deterministic MockExtractor."""
    client = TestClient(app)
    app.dependency_overrides[get_document_extractor] = lambda: MockExtractor()
    try:
        yield client
    finally:
        app.dependency_overrides.clear()


@pytest.fixture()
def ocr_client():
    """Client running the real auto-selected extractor (Tesseract when possible)."""
    client = TestClient(app)
    app.dependency_overrides[get_document_extractor] = lambda: build_extractor()
    try:
        yield client
    finally:
        app.dependency_overrides.clear()


@pytest.fixture()
def tiny_limit_client():
    """Client whose service enforces a 1-byte limit -> triggers the 413 path."""
    client = TestClient(app)
    tiny = DocumentExtractionService(MockExtractor(), max_size_bytes=1)

    def _tiny_service() -> DocumentExtractionService:
        return tiny

    app.dependency_overrides[extraction_get_service] = _tiny_service
    try:
        yield client
    finally:
        app.dependency_overrides.clear()