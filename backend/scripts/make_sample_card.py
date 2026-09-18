"""Generate a fictional sample insurance card for demos and tests.

Draws a "Delta Dental of California" style dental insurance card with PIL so
it can be used both as an OCR live-test and as the deterministic fixture shown
in the UI. All data is completely fictional.

Usage:
    python -m scripts.make_sample_card            # writes to tests/fixtures
    python -m scripts.make_sample_card OUT_DIR    # writes to OUT_DIR
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BACKEND_DIR = Path(__file__).resolve().parents[1]

EXPECTED_FIELDS = {
    "payer_name": "Delta Dental of California",
    "subscriber_name": "Emily Carter",
    "member_id": "ABC123456",
    "group_number": "G-8712",
    "date_of_birth": "1993-07-22",
    # NOTE: intentionally NO policy number on the card -> stays null.
}

CARD_W, CARD_H = 680, 400


def _font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    candidates = [
        ("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
        ("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
        "C:/Windows/Fonts/calibri.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def build_sample_card() -> Image.Image:
    """Render the fictional insurance card as a PIL image."""
    img = Image.new("RGB", (CARD_W, CARD_H), "#ffffff")
    draw = ImageDraw.Draw(img)

    # Header band + left accent.
    draw.rectangle([0, 0, CARD_W, 92], fill="#0b5a9a")
    draw.rectangle([0, 92, 12, CARD_H], fill="#0b5a9a")

    draw.text((36, 20), "DELTA DENTAL", font=_font(34, bold=True), fill="#ffffff")
    draw.text((40, 62), "OF CALIFORNIA", font=_font(14, bold=True), fill="#cfe6ff")
    draw.text((CARD_W - 250, 24), "PLAN: DENTAL PPO 1000", font=_font(13), fill="#ffffff")

    y = 120

    def label(text: str, value: str, yy: int, bold_value: bool = False) -> int:
        draw.text((36, yy), text, font=_font(11), fill="#4b5563")
        draw.text((36, yy + 16), value, font=_font(15, bold=bold_value), fill="#111827")
        return yy + 52

    y = label("SUBSCRIBER", "EMILY CARTER", y, bold_value=True)
    y = label("MEMBER ID", "ABC123456", y, bold_value=True)
    left_col = y

    yy = 120
    yy = label("GROUP NO.", "G-8712", yy)
    yy = label("DATE OF BIRTH", "07/22/1993", yy)
    yy = label("EFFECTIVE", "01/01/2026", yy)

    draw.text((CARD_W - 250, 316), "DENTAL PPO 1000", font=_font(12, bold=True), fill="#0b5a9a")
    draw.text((CARD_W - 250, 338), "Customer Service: 1-800-555-0134", font=_font(11), fill="#4b5563")

    draw.rectangle([0, 368, CARD_W, CARD_H], fill="#0b5a9a")
    draw.text((36, 378), "FOLLOW THIS CARD IS A FICTIONAL SAMPLE - NOT A REAL CARD", font=_font(10), fill="#ffffff")

    return img


def save_fixtures(out_dir: Path) -> None:
    """Write sample_insurance_card.png and .pdf into ``out_dir``."""
    out_dir.mkdir(parents=True, exist_ok=True)
    img = build_sample_card()
    img.save(out_dir / "sample_insurance_card.png")
    img.convert("RGB").save(out_dir / "sample_insurance_card.pdf", "PDF", resolution=150)


def main() -> None:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else BACKEND_DIR / "tests" / "fixtures"
    save_fixtures(target)
    print(f"Wrote sample card fixtures to {target}")


if __name__ == "__main__":
    main()