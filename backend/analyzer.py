"""Synthetic-ID image analysis from IMAGE PIXELS ONLY.

HACKATHON-DEMO QUALITY — not production identity verification.
PNG metadata and client-supplied fields are NEVER treated as OCR proof.
Unreadable fields are reported as unreadable and block PASS.
"""
from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any

from PIL import Image, ImageStat

from .references import cross_check, lookup

try:
    import pytesseract  # type: ignore
except Exception:  # pragma: no cover - environment dependent
    pytesseract = None  # type: ignore

DOC_NUMBER_RE = re.compile(r"\b[A-Z0-9]{2,}-?[A-Z0-9]{3,}\b")
EXPIRY_RES = [
    re.compile(r"EXP(?:IRY|IRATION)?\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})", re.I),
    re.compile(r"EXP(?:IRY|IRATION)?\s*[:\-]?\s*(\d{2}/\d{2}/\d{4})", re.I),
    re.compile(r"\b(\d{4}-\d{2}-\d{2})\b"),
    re.compile(r"\b(\d{2}/\d{2}/\d{4})\b"),
]
NAME_RES = [
    re.compile(r"NAME\s*[:\-]\s*([A-Za-z][A-Za-z .'\-]{1,60})", re.I),
    re.compile(r"HOLDER\s*[:\-]\s*([A-Za-z][A-Za-z .'\-]{1,60})", re.I),
]


def _ocr_text(image: Image.Image) -> tuple[str, list[str]]:
    if pytesseract is None:
        return "", ["ocr-engine-unavailable"]
    try:
        return pytesseract.image_to_string(image) or "", []
    except Exception:
        return "", ["ocr-engine-error"]


def _pick_name(text: str) -> tuple[str | None, str]:
    for rx in NAME_RES:
        m = rx.search(text)
        if m:
            value = re.sub(r"\s+", " ", m.group(1)).strip(" .-")
            if len(value) >= 2:
                return value, "read"
    return None, "unreadable"


def _pick_doc_number(text: str) -> tuple[str | None, str]:
    upper = text.upper()
    label = re.search(r"DOC(?:UMENT)?(?:\s*(?:NO|NUMBER|#))?\s*[:\-]?\s*([A-Z0-9\-]{4,24})", upper)
    if label and DOC_NUMBER_RE.fullmatch(label.group(1).strip()):
        return label.group(1).strip(), "read"
    for cand in DOC_NUMBER_RE.findall(upper):
        if any(ch.isdigit() for ch in cand):
            return cand.strip(), "read"
    return None, "unreadable"


def _parse_date(value: str) -> date | None:
    for fmt in ("%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def _pick_expiry(text: str) -> tuple[str | None, str, str]:
    for rx in EXPIRY_RES:
        m = rx.search(text)
        if not m:
            continue
        parsed = _parse_date(m.group(1))
        if parsed is None:
            continue
        iso = parsed.isoformat()
        if parsed < date.today():
            return iso, "read", "expired"
        return iso, "read", "valid"
    return None, "unreadable", "unknown"


def _readability(image: Image.Image, ocr_text: str) -> dict[str, Any]:
    gray = image.convert("L")
    extrema = gray.getextrema()
    contrast = (extrema[1] - extrema[0]) if extrema else 0
    text_len = len(ocr_text.strip())
    if text_len >= 20 and contrast >= 40:
        level, ok = "good", True
    elif text_len >= 8 and contrast >= 25:
        level, ok = "low", True
    else:
        level, ok = "poor", False
    return {"level": level, "sufficient": ok,
            "detail": "pixel-contrast + OCR character count"}


def _tamper(image: Image.Image) -> dict[str, Any]:
    indicators: list[str] = []
    gray = image.convert("L")
    extrema = gray.getextrema()
    contrast = (extrema[1] - extrema[0]) if extrema else 0
    if contrast < 15:
        indicators.append("flat-image-suspect")
    if image.size[0] < 400 or image.size[1] < 250:
        indicators.append("resolution-too-low")
    blocking = "flat-image-suspect" in indicators
    return {"indicators": indicators, "blocking": blocking,
            "note": "hackathon-demo heuristics only"}


def analyze_image_pixels(path: str, doc_hash_hex: str = "") -> dict[str, Any]:
    """Analyze a synthetic ID image. Never reads metadata as proof.

    Cross-checks OCR values against the trusted server-side reference for
    this file hash. OCR/reference values stay server-side; only statuses
    (match/mismatch/unreadable/unavailable) are returned. Unknown hashes
    (no reference) force REVIEW with no attestation.
    """
    reasons: list[str] = []
    warnings: list[str] = []
    with Image.open(path) as img:
        img.load()
        pixels = img.convert("RGB")
        text, ocr_warnings = _ocr_text(pixels)
        warnings.extend(ocr_warnings)
        readability = _readability(pixels, text)
        tamper = _tamper(pixels)

    name, name_status = _pick_name(text)
    doc_no, doc_status = _pick_doc_number(text)
    expiry, expiry_status, freshness = _pick_expiry(text)

    reference = lookup(doc_hash_hex) if doc_hash_hex else None
    checks = cross_check(name, doc_no, expiry, reference)

    if pytesseract is None:
        reasons.append("OCR engine unavailable; fields unreadable.")
    if name_status != "read":
        reasons.append("Name unreadable from image pixels.")
    elif checks["name"] == "mismatch":
        reasons.append("Name does not match the trusted reference.")
    if doc_status != "read":
        reasons.append("Document number unreadable from image pixels.")
    elif checks["document_number"] == "mismatch":
        reasons.append("Document number does not match the trusted reference.")
    if expiry_status != "read":
        reasons.append("Expiry unreadable from image pixels.")
    elif freshness == "expired":
        reasons.append("Document expired.")
    elif checks["expiry"] == "mismatch":
        reasons.append("Expiry does not match the trusted reference.")
    if reference is None:
        reasons.append("No trusted reference for this document; manual review required.")
    if not readability["sufficient"]:
        reasons.append(f"Readability {readability['level']}; too weak for PASS.")
    if tamper["blocking"]:
        reasons.append("Blocking tamper indicator present.")
    warnings.extend(tamper["indicators"])

    all_match = all(v == "match" for v in checks.values())
    attestation_eligible = bool(
        reference is not None
        and all_match
        and freshness == "valid"
        and readability["sufficient"]
        and not tamper["blocking"]
    )

    if attestation_eligible:
        verdict = "PASS"
    elif freshness == "expired" or tamper["blocking"] or not readability["sufficient"]:
        verdict = "FAIL"
    elif reference is None:
        verdict = "REVIEW"
    elif any(v == "mismatch" for v in checks.values()):
        verdict = "FAIL"
    else:
        verdict = "REVIEW"

    return {
        "verdict": verdict,
        "attestation_eligible": attestation_eligible,
        "reasons": reasons,
        "warnings": warnings,
        "fields": {
            "name": {"read": name_status, "match": checks["name"]},
            "document_number": {"read": doc_status, "match": checks["document_number"]},
            "expiry": {"read": expiry_status, "freshness": freshness, "match": checks["expiry"]},
        },
        "readability": readability,
        "tamper": tamper,
        "disclaimer": "HACKATHON-DEMO QUALITY - not production identity verification.",
    }
