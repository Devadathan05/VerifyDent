"""Tesseract-based OCR extraction provider.

Real local OCR implementation used for the hackathon MVP. It is a drop-in
implementation of ``DocumentExtractor`` and can be swapped for a cloud OCR
provider (or replaced by the mock adapter) without touching the rest of the
codebase.

Extraction approach (kept small and explainable for the Q&A):

1. Render the document to image(s): pass images straight through, render PDF
   pages with pypdfium2 (no system Poppler dependency).
2. OCR each image with Tesseract via ``pytesseract.image_to_data``, which gives
   per-word text *and* a per-word confidence score.
3. Rebuild OCR "lines" from words; a line carries the average word confidence.
4. Match known label patterns (``ID:``, ``GROUP``, ``DATE OF BIRTH``, ...) with
   regular expressions. The value is the token run following the label.
5. Field confidence = average confidence of the OCR line that contained the
   match. Explicitly missing fields are returned with ``value=None`` and a
   ``confidence`` of ``None`` — we never invent missing data.
"""

from __future__ import annotations

import re
import shutil
import os
from datetime import date, datetime
from typing import List, Optional, Tuple

from PIL import Image

from app.core.config import Settings, get_settings

from .base import DocumentExtractor, DocumentExtractionError, ExtractedValue, InsuranceExtraction

# ---------------------------------------------------------------------------
# Label->field pattern mapping. Each entry is tested in order; the first hit
# wins. Values are uppercase token runs following the printed label.
# ---------------------------------------------------------------------------

_MEMBER_ID_RE = re.compile(
    r"\b(?:SUBSCRIBER\s+ID|MEMBER\s+ID|CUSTOMER\s+ID|MEDICARE\s+NUMBER(?:/NUMERO\s+DE\s+MEDICARE)?|ID)\s*[:\s#-/]*\s*([A-Z0-9][A-Z0-9.#/\\-]{2,})\b",
    re.IGNORECASE
)

_GROUP_RE = re.compile(
    r"\b(?:GRP(?:\.|\b)?|GROUP(?:\s*(?:NO|NUMBER|#|\.)|#)?)\s*[:\s#-]*\s*([A-Z0-9][A-Z0-9.#/\\-]{2,})\b",
    re.IGNORECASE
)

_POLICY_RE = re.compile(
    r"\b(?:POLICY(?:\s*(?:NO|NUMBER|#|\.)|#)?|CERT(?:IF\.?|#|NUMBER|IFICATE)?)\s*[:\s#-]*\s*([A-Z0-9][A-Z0-9.#/\\-]{2,})\b",
    re.IGNORECASE
)

_SUBSCRIBER_RE = re.compile(
    r"\b(?:MEMBER\s+EMPLOYEE\s+NAME|EMPLOYEE\s+NAME|SUBSCRIBER(?:\s+NAME)?|MEMBER(?:\s+NAME)?|NAME(?:/NOMBRE)?)\s*[:\s#-/]*\s*((?:(?!\b(?:MEDICARE|NUMBER|NUMERO|ID|GROUP|DOB|DATE)\b)[A-Za-z.'-]+\s*){1,4})",
    re.IGNORECASE
)

_DOB_RE = re.compile(
    r"\b(?:DATE\s+OF\s+BIRTH|BIRTH\s*DATE|DOB|BIRTH)\s*[:\s#-]*\s*"
    r"([0-9]{1,2}[/.-][0-9]{1,2}[/.-][0-9]{2,4}|[A-Z][a-z]+\.?\s+[0-9]{1,2},?\s+[0-9]{4})\b",
    re.IGNORECASE
)

_RELATIONSHIP_RE = re.compile(r"\bRELATIONSHIP\s*[:\s#-]*\s*([A-Z][A-Z\s.-]{2,})\b", re.IGNORECASE)
_EHIC_TITLE_RE = re.compile(r"EUROPEAN\s+HEALTH\s+INSURANCE\s+CARD", re.IGNORECASE)
_NUMBERED_LINE_RE = re.compile(r"^\s*(\d{1,2})[.)\-:]?\s+(.+?)\s*$")

# Lines that are never the payer name (contact info, boilerplate, plan codes).
_SKIP_PAYER_UNLESS = re.compile(
    r"(^\d|1-800|800-\d|©|CUSTOMER|CALL|WWW|\.COM|PO BOX|MEMBER ID|SUBSCRIBER|NAME:|\.\d{3})",
    re.IGNORECASE,
)


def _month_name_to_number(month: str) -> Optional[int]:
    mapping = {
        "january": 1, "february": 2, "march": 3, "april": 4, "may": 5,
        "june": 6, "july": 7, "august": 8, "september": 9, "october": 10,
        "november": 11, "december": 12,
    }
    key = month.replace(".", "").strip().lower()
    if key in mapping:
        return mapping[key]
    if len(key) >= 3:
        return next((num for name, num in mapping.items() if name.startswith(key)), None)
    return None


def normalize_date(raw: Optional[str]) -> Optional[str]:
    """Normalise various OCR date formats into ISO ``YYYY-MM-DD``.

    Returns ``None`` when the value cannot be parsed. A 4-digit year is
    preferred to disambiguate month/day order; otherwise US-style
    MM/DD/YYYY is assumed (a documented MVP limitation).
    """
    if raw is None:
        return None
    raw = raw.strip().rstrip(",")
    if not raw:
        return None

    # YYYY-MM-DD / YYYY/MM/DD already ISO-like.
    for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            pass

    # Numeric formats, preferring a 4-digit year.
    parts = re.split(r"[/.\-]", raw)
    if len(parts) == 3:
        nums = [int(p) for p in parts]
        year = next((n for n in nums if n > 999), None)
        others = [n for n in nums if n <= 999]
        if year is not None and len(others) == 2:
            month, day = min(others), max(others)
            try:
                return date(year=year, month=month, day=day).isoformat()
            except ValueError:
                return None
        # Two-digit year: assume MM/DD/YY.
        if all(n <= 99 for n in nums):
            y = 2000 + nums[2] if nums[2] < 70 else 1900 + nums[2]
            try:
                return date(year=y, month=nums[0], day=nums[1]).isoformat()
            except ValueError:
                return None

    # English month names, e.g. "May 14, 1988" or "Jan 05 1990".
    month_match = re.match(r"^([A-Za-z.]+)\s+([0-9]{1,2})[,]?\s+([0-9]{4})$", raw)
    if month_match:
        month = _month_name_to_number(month_match.group(1))
        if month:
            try:
                return date(year=int(month_match.group(3)), month=month, day=int(month_match.group(2))).isoformat()
            except ValueError:
                return None

    return None


class TesseractExtractor(DocumentExtractor):
    """Extracts insurance fields using the local Tesseract OCR engine."""

    provider_name = "tesseract-ocr"

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._configure_tesseract_path(self._settings.tesseract_cmd)

    @staticmethod
    def _configure_tesseract_path(cmd: str | None) -> str | None:
        import pytesseract

        candidates = [
            cmd,
            os.environ.get("TESSERACT_CMD"),
            shutil.which("tesseract"),
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        ]
        candidate = next((path for path in candidates if path and os.path.isfile(path)), None)
        if candidate:
            pytesseract.pytesseract.tesseract_cmd = candidate
        return candidate

    @classmethod
    def available(cls, cmd: str | None = None) -> bool:
        """True when the Tesseract binary can actually be run."""
        try:
            cls._configure_tesseract_path(cmd)
            import pytesseract
            pytesseract.get_tesseract_version()
            return True
        except Exception:
            return False

    def extract(self, file_path: str, file_type: str) -> InsuranceExtraction:
        self._configure_tesseract_path(self._settings.tesseract_cmd)
        lines = self._ocr_document(file_path, file_type)
        return self._build_extraction(lines)

    # -- rendering ---------------------------------------------------------

    def _ocr_document(self, file_path: str, file_type: str) -> List[Tuple[str, float]]:
        try:
            if file_type == "pdf":
                return self._ocr_pdf(file_path)
            return self._ocr_image(file_path)
        except DocumentExtractionError:
            raise
        except Exception as exc:  # pytesseract / pypdfium2 failures
            raise DocumentExtractionError(f"OCR failed: {exc}") from exc

    def _ocr_pdf(self, file_path: str) -> List[Tuple[str, float]]:
        try:
            import pypdfium2 as pdfium
        except ImportError as exc:  # pragma: no cover
            raise DocumentExtractionError("pypdfium2 not installed; cannot OCR PDFs") from exc

        lines: List[Tuple[str, float]] = []
        with pdfium.PdfDocument(file_path) as doc:
            for page in doc:
                bitmap = page.render(scale=200.0 / 72.0)
                image = bitmap.to_pil()
                lines.extend(self._ocr_image_object(image))
        return lines

    def _ocr_image(self, file_path: str) -> List[Tuple[str, float]]:
        with Image.open(file_path) as image:
            return self._ocr_image_object(image)

    def _ocr_image_object(self, image: Image.Image) -> List[Tuple[str, float]]:
        try:
            import pytesseract
        except ImportError as exc:  # pragma: no cover
            raise DocumentExtractionError("pytesseract not installed; cannot OCR") from exc

        gray = image.convert("L")
        try:
            data = pytesseract.image_to_data(
                gray, output_type=pytesseract.Output.DICT, config="--psm 6"
            )
        except pytesseract.TesseractError as exc:
            raise DocumentExtractionError(f"Tesseract engine error: {exc}") from exc

        word_groups: dict = {}
        for idx, text in enumerate(data["text"]):
            text = (text or "").strip()
            if not text:
                continue
            key = (data["block_num"][idx], data["par_num"][idx], data["line_num"][idx])
            conf = float(data["conf"][idx]) if data["conf"][idx] != "-1" else 0.0
            word_groups.setdefault(key, []).append((text, conf))

        lines: List[Tuple[str, float]] = []
        for words in word_groups.values():
            line_text = " ".join(word for word, _ in words)
            avg_conf = sum(conf for _, conf in words) / len(words) / 100.0
            lines.append((line_text, min(max(avg_conf, 0.0), 1.0)))
        return lines

    # -- field extraction --------------------------------------------------

    def _build_extraction(self, lines: List[Tuple[str, float]]) -> InsuranceExtraction:
        if not lines:
            raise DocumentExtractionError("No text could be OCR'd from the document")

        norm = " ".join(text for text, _ in lines)

        subscriber, sub_conf = self._value_after_label(norm, _SUBSCRIBER_RE, lines)

        member_id, member_conf = self._value_after_label(norm, _MEMBER_ID_RE, lines)
        group, group_conf = self._value_after_label(norm, _GROUP_RE, lines)
        policy, policy_conf = self._value_after_label(norm, _POLICY_RE, lines)
        dob, dob_conf = self._value_after_label(norm, _DOB_RE, lines)
        rel, rel_conf = self._value_after_label(norm, _RELATIONSHIP_RE, lines)

        first_name, last_name, name_conf = self._split_name(subscriber, sub_conf)

        relationship, relationship_conf = self._resolve_relationship(
            rel, rel_conf, subscriber, sub_conf
        )

        payer, payer_conf = self._find_payer(lines)

        if _EHIC_TITLE_RE.search(norm):
            subscriber, first_name, last_name, dob, sub_conf, dob_conf = self._parse_ehic(lines)
            # EHIC numbered fields do not map safely to US dental payer/group
            # fields. Leave those values null and preserve the raw OCR text.
            member_id = group = policy = payer = rel = relationship = None
            member_conf = group_conf = policy_conf = payer_conf = rel_conf = relationship_conf = None

        return InsuranceExtraction(
            first_name=ExtractedValue(value=first_name, confidence=name_conf),
            last_name=ExtractedValue(value=last_name, confidence=name_conf),
            date_of_birth=ExtractedValue(value=normalize_date(dob), confidence=dob_conf if dob else dob_conf),
            member_id=ExtractedValue(value=member_id, confidence=member_conf),
            group_number=ExtractedValue(value=group, confidence=group_conf),
            policy_number=ExtractedValue(value=policy, confidence=policy_conf),
            payer_name=ExtractedValue(value=payer, confidence=payer_conf),
            subscriber_name=ExtractedValue(value=subscriber, confidence=sub_conf),
            relationship_to_subscriber=ExtractedValue(value=relationship, confidence=relationship_conf),
            raw_text="\n".join(text for text, _ in lines),
        )

    def _parse_ehic(
        self, lines: List[Tuple[str, float]]
    ) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str], Optional[float], Optional[float]]:
        numbered: dict[int, Tuple[str, float]] = {}
        for text, confidence in lines:
            match = _NUMBERED_LINE_RE.match(text)
            if match:
                numbered[int(match.group(1))] = (match.group(2).strip(), confidence)

        surname, surname_conf = numbered.get(1, (None, None))
        given_name, given_conf = numbered.get(2, (None, None))
        raw_dob, dob_conf = numbered.get(3, (None, None))
        if not surname or not given_name:
            return None, None, None, normalize_date(raw_dob), None, dob_conf

        subscriber = f"{given_name} {surname}"
        name_conf = min(surname_conf or 0.0, given_conf or 0.0)
        return subscriber, given_name, surname, normalize_date(raw_dob), name_conf, dob_conf

    def _value_after_label(
        self,
        norm: str,
        pattern: "re.Pattern[str]",
        lines: List[Tuple[str, float]],
    ) -> Tuple[Optional[str], Optional[float]]:
        """Find ``pattern`` in the normalized text and return (value, confidence)."""
        match = pattern.search(norm)
        if not match:
            return None, None
        value = match.group(1).strip()
        if not value:
            return None, None
        return value, self._line_confidence_for(norm, lines, match.start())

    @staticmethod
    def _line_confidence_for(
        norm: str, lines: List[Tuple[str, float]], position: int
    ) -> Optional[float]:
        """Confidence of the OCR line that owns ``position`` in ``norm``."""
        offset = 0
        for text, conf in lines:
            if offset <= position < offset + len(text):
                return conf
            offset += len(text) + 1
        return None

    def _split_name(
        self, subscriber: Optional[str], conf: Optional[float]
    ) -> Tuple[Optional[str], Optional[str], Optional[float]]:
        if not subscriber:
            return None, None, None
        parts = subscriber.split()
        first = parts[0]
        last = parts[-1] if len(parts) > 1 else None
        confidence = round((conf or 0.0) * 0.95, 4)
        return first, last, confidence

    def _resolve_relationship(
        self,
        rel: Optional[str],
        rel_conf: Optional[float],
        subscriber: Optional[str],
        subscriber_conf: Optional[float],
    ) -> Tuple[Optional[str], Optional[float]]:
        if rel:
            return rel, rel_conf
        if subscriber:
            # Dental cards print the subscriber; when no explicit relationship
            # label is present we assume the patient is the subscriber ("Self")
            # but down-weight the confidence so the reviewer double-checks it.
            return "Self", round((subscriber_conf or 0.0) * 0.7, 4)
        return None, None

    def _find_payer(self, lines: List[Tuple[str, float]]) -> Tuple[Optional[str], Optional[float]]:
        """Payer name = the first alphabetic line that is not boilerplate."""
        for text, conf in lines:
            text = text.strip()
            if not text or len(text) < 3:
                continue
            if _SKIP_PAYER_UNLESS.search(text):
                continue
            if any(ch.isalpha() for ch in text):
                return text[:100], conf
        return None, None


__all__ = ["TesseractExtractor", "normalize_date"]