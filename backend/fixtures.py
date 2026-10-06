"""Generate known synthetic ID fixtures with Pillow (no real IDs, no PII).

Two fixtures:
- valid:   fields match the trusted server reference -> eligible for PASS
- edited:  name line altered so OCR reads a different name -> must mismatch

Images are large high-contrast renders so Tesseract can read them.
Generation is deterministic (fixed pixels) so sha256 hashes are stable.
"""
from __future__ import annotations

import hashlib
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from .references import register

FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures"

VALID = {
    "filename": "synthetic_valid.png",
    "name": "AVA SYNTHETIC",
    "document_number": "SYN-10001",
    "expiry": "2030-12-31",
}
EDITED = {
    "filename": "synthetic_edited.png",
    "name": "AVA TAMPERED",
    "document_number": "SYN-10001",
    "expiry": "2030-12-31",
}
# The edited image shows a different name than the trusted reference, so the
# cross-check must report mismatch for the name field.
EDITED_REFERENCE = {
    "name": VALID["name"],
    "document_number": VALID["document_number"],
    "expiry": VALID["expiry"],
}


def _font(size: int):
    for candidate in ("arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(candidate, size)
        except Exception:
            continue
    return ImageFont.load_default()


def _render(path: Path, name: str, doc: str, expiry: str) -> None:
    img = Image.new("RGB", (1200, 700), "white")
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, 1199, 699], outline="black", width=8)
    draw.rectangle([40, 40, 1160, 200], outline="black", width=4)
    f_big, f_med = _font(72), _font(56)
    draw.text((80, 70), "SYNTHETIC ID - DEMO ONLY", fill="black", font=f_big)
    draw.text((80, 260), f"NAME: {name}", fill="black", font=f_med)
    draw.text((80, 360), f"DOC NO: {doc}", fill="black", font=f_med)
    draw.text((80, 460), f"EXPIRY: {expiry}", fill="black", font=f_med)
    draw.text((80, 580), "SPECIMEN - NOT A REAL DOCUMENT", fill="black", font=f_med)
    img.save(path, "PNG")


def ensure_fixtures() -> dict[str, str]:
    """Create fixtures (if missing) and register trusted references.

    Returns {valid_hash, edited_hash}. Reference PII stays server-side.
    """
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    valid_path = FIXTURE_DIR / VALID["filename"]
    edited_path = FIXTURE_DIR / EDITED["filename"]
    if not valid_path.exists():
        _render(valid_path, VALID["name"], VALID["document_number"], VALID["expiry"])
    if not edited_path.exists():
        _render(edited_path, EDITED["name"], EDITED["document_number"], EDITED["expiry"])
    valid_hash = "0x" + hashlib.sha256(valid_path.read_bytes()).hexdigest()
    edited_hash = "0x" + hashlib.sha256(edited_path.read_bytes()).hexdigest()
    register(valid_hash, VALID["name"], VALID["document_number"], VALID["expiry"])
    register(edited_hash, EDITED_REFERENCE["name"],
             EDITED_REFERENCE["document_number"], EDITED_REFERENCE["expiry"])
    return {"valid": valid_hash, "edited": edited_hash}
