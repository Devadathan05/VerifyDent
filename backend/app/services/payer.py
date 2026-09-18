"""Payer identification and normalization service."""

from typing import Optional
import re

# Small registry of known payers for the MVP.
# In a real app, this would be a database table mapped to clearinghouse payer IDs.
KNOWN_PAYERS = {
    "DELTA_DENTAL": "Delta Dental",
    "CIGNA": "Cigna Dental",
    "AETNA": "Aetna Dental",
    "METLIFE": "MetLife Dental",
    "UHC": "UnitedHealthcare Dental",
}

# Regex patterns to fuzzily match payer names from OCR text
PAYER_PATTERNS = {
    "DELTA_DENTAL": re.compile(r"\bdelta\s+dental\b", re.IGNORECASE),
    "CIGNA": re.compile(r"\bcigna\b", re.IGNORECASE),
    "AETNA": re.compile(r"\baetna\b", re.IGNORECASE),
    "METLIFE": re.compile(r"\bmetlife\b", re.IGNORECASE),
    "UHC": re.compile(r"\b(?:united\s*healthcare|uhc)\b", re.IGNORECASE),
}

def identify_payer(raw_name: Optional[str]) -> str:
    """
    Normalizes a raw payer string (e.g. from OCR) into a known internal payer representation.
    Returns "UNKNOWN" if it cannot be confidently identified.
    """
    if not raw_name:
        return "UNKNOWN"
    
    # Try to match using patterns
    for key, pattern in PAYER_PATTERNS.items():
        if pattern.search(raw_name):
            return KNOWN_PAYERS[key]
            
    return "UNKNOWN"
