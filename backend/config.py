"""TrustKYC backend configuration — env-driven only. No secrets in code.

Secrets live in backend/.env (never committed). This module only reads
environment variables and applies safe defaults for non-secret settings.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

EXPECTED_CHAIN_ID = int(os.getenv("CHAIN_ID", "11155111"))
CONTRACT_ADDRESS = os.getenv("TRUSTKYC_CONTRACT_ADDRESS", "").strip()
SEPOLIA_RPC_URL = os.getenv("SEPOLIA_RPC_URL", "").strip()
# Primary verifier key var; legacy fallback kept for older .env files.
VERIFIER_PRIVATE_KEY = (
    os.getenv("VERIFIER_PRIVATE_KEY", "").strip()
    or os.getenv("BACKEND_SIGNER_PRIVATE_KEY", "").strip()
)
EXPECTED_VERIFIER_ADDRESS = os.getenv("EXPECTED_VERIFIER_ADDRESS", "").strip()
FLASK_SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "change-me")
MAX_IMAGE_MB = float(os.getenv("MAX_IMAGE_MB", "5"))
ATTESTATION_TTL_SECONDS = int(os.getenv("ATTESTATION_TTL_SECONDS", "900"))
CHALLENGE_TTL_SECONDS = int(os.getenv("CHALLENGE_TTL_SECONDS", "300"))
UPLOAD_TMP_DIR = os.getenv("UPLOAD_TMP_DIR", "../storage/uploads_tmp")

ABI_PATH = Path(__file__).resolve().parent / "abi.json"

EIP712_DOMAIN_NAME = "TrustKYC"
EIP712_DOMAIN_VERSION = "1"

ALLOWED_IMAGE_FORMATS = {"PNG", "JPEG"}
