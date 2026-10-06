"""Trusted server-side reference data for known synthetic fixtures.

HACKATHON-DEMO ONLY. These are invented values for generated test images.
Client-entered values and image metadata are NEVER trusted references;
only this server-side registry (keyed by sha256 of the file bytes) counts.

Unknown uploads (hash not in this registry) have no trusted reference and
must be verdict REVIEW with no attestation.
"""
from __future__ import annotations

# sha256_hex -> {"name": ..., "document_number": ..., "expiry": "YYYY-MM-DD"}
# Filled at server start by fixtures.ensure_fixtures(); tests may also
# register entries directly. Values are PII-sensitive: never returned.
REFERENCES: dict[str, dict[str, str]] = {}


def lookup(doc_hash_hex: str) -> dict[str, str] | None:
    return REFERENCES.get(doc_hash_hex.lower())


def register(doc_hash_hex: str, name: str, document_number: str, expiry: str) -> None:
    REFERENCES[doc_hash_hex.lower()] = {
        "name": name,
        "document_number": document_number,
        "expiry": expiry,
    }


def _norm_name(value: str) -> str:
    return " ".join(value.strip().upper().split())


def _norm_doc(value: str) -> str:
    return value.strip().upper().replace(" ", "").replace("_", "-")


def cross_check(
    ocr_name: str | None,
    ocr_doc: str | None,
    ocr_expiry_iso: str | None,
    reference: dict[str, str] | None,
) -> dict[str, str]:
    """Compare OCR reads to the trusted reference. Statuses only.

    Returns per-field status in {match, mismatch, unreadable, unavailable}.
    'unavailable' means no trusted reference exists for this document.
    """
    if reference is None:
        return {"name": "unavailable", "document_number": "unavailable", "expiry": "unavailable"}
    out: dict[str, str] = {}
    out["name"] = (
        "unreadable" if not ocr_name
        else ("match" if _norm_name(ocr_name) == _norm_name(reference["name"]) else "mismatch")
    )
    out["document_number"] = (
        "unreadable" if not ocr_doc
        else ("match" if _norm_doc(ocr_doc) == _norm_doc(reference["document_number"]) else "mismatch")
    )
    out["expiry"] = (
        "unreadable" if not ocr_expiry_iso
        else ("match" if ocr_expiry_iso == reference["expiry"] else "mismatch")
    )
    return out
