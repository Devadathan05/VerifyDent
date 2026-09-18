"""Insurance document ingestion + extraction endpoint.

POST /api/insurance/upload  — accepts a PDF / PNG / JPG / JPEG insurance
card, validates it, runs the configured extraction provider, and returns the
structured extraction result. Documents are stored temporarily and deleted
after processing. No Patient / InsurancePolicy records are created here.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.schemas import InsuranceExtractionResponse
from app.services.document_extraction import (
    CorruptFileError,
    DocumentExtractionError,
    DocumentExtractionService,
    DocumentExtractor,
    EmptyFileError,
    ExtractionUnavailableError,
    FileTooLargeError,
    InvalidFileTypeError,
    get_document_extraction_service,
    get_document_extractor,
)

router = APIRouter(tags=["insurance-documents"])

# Map validation failures to useful HTTP status codes.
_ERROR_STATUS = {
    EmptyFileError: status.HTTP_400_BAD_REQUEST,
    FileTooLargeError: status.HTTP_413_CONTENT_TOO_LARGE,
    InvalidFileTypeError: status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
    CorruptFileError: status.HTTP_422_UNPROCESSABLE_CONTENT,
    ExtractionUnavailableError: status.HTTP_503_SERVICE_UNAVAILABLE,
}


def get_service(
    extractor: DocumentExtractor = Depends(get_document_extractor),
) -> DocumentExtractionService:
    """Dependency wrapper so tests can override the service (e.g. size limit)."""
    return get_document_extraction_service(extractor)


@router.post("/upload", response_model=InsuranceExtractionResponse)
async def upload_insurance_document(
    file: UploadFile = File(...),
    service: DocumentExtractionService = Depends(get_service),
) -> InsuranceExtractionResponse:
    content = await file.read()

    try:
        result = service.extract(file.filename or "document", content)
    except DocumentExtractionError as exc:
        error_status = _ERROR_STATUS.get(type(exc), status.HTTP_422_UNPROCESSABLE_CONTENT)
        raise HTTPException(status_code=error_status, detail=str(exc)) from exc

    return InsuranceExtractionResponse(
        extracted_at=datetime.now(timezone.utc),
        **result,
    )


__all__ = ["router"]