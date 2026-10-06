"""Wallet challenge auth + EIP-712 PASS attestations.

Challenge flow binds an analysis to the applicant wallet:
1. Frontend calls /challenge with the applicant address -> gets message.
2. Wallet signs the message (personal_sign / eth_signTypedData NOT needed).
3. /analyze verifies that signature before running OCR.

Attestation format matches contracts/TrustKYC.sol EXACTLY:
  domain:  EIP712Domain(name="TrustKYC", version="1",
                        chainId, verifyingContract=contract address)
  message: PassAttestation(address applicant, bytes32 docHash,
                           bytes32 nonce, uint256 expiry)
Only PASS analyses are signed. Backend never submits transactions.
"""
from __future__ import annotations

import secrets
import time
from typing import Any

from eth_account import Account
from eth_account.messages import encode_defunct, encode_typed_data

from . import config

_CHALLENGES: dict[str, dict[str, Any]] = {}


def issue_challenge(applicant: str) -> dict[str, Any]:
    addr = Account.to_checksum_address(applicant)
    nonce = secrets.token_hex(16)
    issued = int(time.time())
    message = (
        f"TrustKYC analysis request\napplicant: {addr}\n"
        f"nonce: {nonce}\nissued: {issued}\n"
        "Sign to bind this synthetic-ID analysis to your wallet."
    )
    _CHALLENGES[addr.lower()] = {
        "message": message,
        "nonce": nonce,
        "issued": issued,
        "used": False,
    }
    return {"applicant": addr, "message": message,
            "expiresIn": config.CHALLENGE_TTL_SECONDS}


def verify_challenge(applicant: str, signature: str) -> tuple[bool, str]:
    try:
        addr = Account.to_checksum_address(applicant)
    except Exception:
        return False, "invalid applicant address"
    rec = _CHALLENGES.get(addr.lower())
    if not rec or rec.get("used"):
        return False, "no active challenge; request /challenge first"
    if int(time.time()) - rec["issued"] > config.CHALLENGE_TTL_SECONDS:
        return False, "challenge expired; request a new one"
    try:
        recovered = Account.recover_message(
            encode_defunct(text=rec["message"]), signature=signature
        )
    except Exception:
        return False, "unverifiable signature"
    if recovered.lower() != addr.lower():
        return False, "signature does not match applicant"
    rec["used"] = True
    return True, "ok"


def sign_pass_attestation(applicant: str, doc_hash_hex: str) -> dict[str, str]:
    """Sign a PASS attestation. Caller must have already gated on PASS."""
    addr = Account.to_checksum_address(applicant)
    nonce_hex = "0x" + secrets.token_hex(32)
    expiry = int(time.time()) + config.ATTESTATION_TTL_SECONDS
    domain = {
        "name": config.EIP712_DOMAIN_NAME,
        "version": config.EIP712_DOMAIN_VERSION,
        "chainId": config.EXPECTED_CHAIN_ID,
        "verifyingContract": Account.to_checksum_address(config.CONTRACT_ADDRESS),
    }
    types = {
        "EIP712Domain": [
            {"name": "name", "type": "string"},
            {"name": "version", "type": "string"},
            {"name": "chainId", "type": "uint256"},
            {"name": "verifyingContract", "type": "address"},
        ],
        "PassAttestation": [
            {"name": "applicant", "type": "address"},
            {"name": "docHash", "type": "bytes32"},
            {"name": "nonce", "type": "bytes32"},
            {"name": "expiry", "type": "uint256"},
        ],
    }
    message = {
        "applicant": addr,
        "docHash": bytes.fromhex(doc_hash_hex.removeprefix("0x")),
        "nonce": bytes.fromhex(nonce_hex.removeprefix("0x")),
        "expiry": expiry,
    }
    encoded = encode_typed_data(
        domain_data=domain, message_types=types, message_data=message
    )
    signed = Account.sign_message(encoded, private_key=config.VERIFIER_PRIVATE_KEY)
    return {
        "applicant": addr,
        "docHash": "0x" + doc_hash_hex.removeprefix("0x").lower(),
        "nonce": nonce_hex,
        "expiry": str(expiry),
        "signature": "0x" + signed.signature.hex().removeprefix("0x"),
        "chainId": str(config.EXPECTED_CHAIN_ID),
        "contractAddress": Account.to_checksum_address(config.CONTRACT_ADDRESS),
    }
