"""TrustKYC Flask backend (Sepolia testnet, hackathon demo).

HACKATHON-DEMO QUALITY — OCR/tamper checks are illustrative, not production
identity verification. Synthetic documents ONLY.

Endpoints:
  GET  /health    -> chain + contract + verifier consistency checks
  POST /challenge -> {applicant} -> message for the wallet to sign
  POST /analyze   -> multipart image + applicant + challenge signature
                     -> verdict + reasons; attestation ONLY on PASS

Privacy: never log/return raw images, PII values, secrets, or file paths.
Temp files are deleted after every analysis. No transactions are sent.
"""
from __future__ import annotations

import hashlib
import os
import tempfile
from pathlib import Path

from eth_account import Account
from flask import Flask, jsonify, request
from PIL import Image

from . import config
from .analyzer import analyze_image_pixels
from .auth import issue_challenge, sign_pass_attestation, verify_challenge
from .chain import health as chain_health
from .fixtures import ensure_fixtures

ensure_fixtures()

app = Flask(__name__)
app.secret_key = config.FLASK_SECRET_KEY
app.config["MAX_CONTENT_LENGTH"] = int(config.MAX_IMAGE_MB * 1024 * 1024)

# Allow the local Vite app and explicitly configured deployment origins.
_cors_origins = {
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
}


@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    if origin in _cors_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response

DEMO_DISCLAIMER = "HACKATHON-DEMO QUALITY - not production identity verification."
SYNTHETIC_ONLY = "Synthetic documents only; never submit real IDs."


def _tmp_dir() -> Path:
    base = Path(__file__).resolve().parent / config.UPLOAD_TMP_DIR
    base.mkdir(parents=True, exist_ok=True)
    return base


@app.get("/health")
def health():
    body, status = chain_health()
    body["service"] = "trustkyc-backend"
    return jsonify(body), status


@app.post("/challenge")
def challenge():
    data = request.get_json(silent=True) or {}
    applicant = (data.get("applicant") or "").strip()
    if not applicant:
        return jsonify({"error": "applicant is required"}), 400
    try:
        return jsonify(issue_challenge(applicant)), 200
    except Exception:
        return jsonify({"error": "invalid applicant address"}), 400


@app.post("/analyze")
def analyze():
    applicant = (request.form.get("applicant") or "").strip()
    wallet_sig = (request.form.get("walletSignature") or "").strip()
    if not applicant or not wallet_sig:
        return jsonify({"error": "applicant and walletSignature are required"}), 400
    try:
        Account.to_checksum_address(applicant)
    except Exception:
        return jsonify({"error": "invalid applicant address"}), 400

    ok, why = verify_challenge(applicant, wallet_sig)
    if not ok:
        return jsonify({"error": f"wallet auth failed: {why}"}), 401

    upload = request.files.get("image")
    if upload is None or not upload.filename:
        return jsonify({"error": "image file is required"}), 400

    tmp_path: str | None = None
    try:
        raw = upload.read()
        max_bytes = int(config.MAX_IMAGE_MB * 1024 * 1024)
        if not raw or len(raw) > max_bytes:
            return jsonify({"error": "image empty or exceeds size limit"}), 400
        doc_hash = "0x" + hashlib.sha256(raw).hexdigest()

        fd, tmp_path = tempfile.mkstemp(suffix=".upload", dir=str(_tmp_dir()))
        with os.fdopen(fd, "wb") as fh:
            fh.write(raw)
        del raw

        try:
            with Image.open(tmp_path) as probe:
                probe.load()
                fmt = (probe.format or "").upper()
            if fmt not in config.ALLOWED_IMAGE_FORMATS:
                return jsonify({"error": f"unsupported image type: {fmt or 'unknown'}"}), 400
        except Exception:
            return jsonify({"error": "unreadable image file"}), 400

        result = analyze_image_pixels(tmp_path, doc_hash)
        verdict = result["verdict"]
        response: dict = {
            "verdict": verdict,
            "reasons": result["reasons"],
            "warnings": result["warnings"],
            "fields": result["fields"],
            "readability": result["readability"],
            "tamper": result["tamper"],
            "docHash": doc_hash,
            "disclaimer": DEMO_DISCLAIMER,
            "syntheticOnly": SYNTHETIC_ONLY,
        }
        if verdict == "PASS" and result.get("attestation_eligible"):
            try:
                response["attestation"] = sign_pass_attestation(applicant, doc_hash)
            except Exception:
                return jsonify({"error": "attestation unavailable; check server config"}), 500
        return jsonify(response), 200
    finally:
        try:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass


@app.get("/")
def index():
    return jsonify({"service": "trustkyc-backend", "disclaimer": DEMO_DISCLAIMER}), 200


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
