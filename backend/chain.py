"""Sepolia chain access + /health checks.

ok only if ALL hold:
- RPC connects
- chain ID == 11155111
- contract code exists at TRUSTKYC_CONTRACT_ADDRESS
- contract verifier() == address derived from configured verifier key
"""
from __future__ import annotations

import json
from typing import Any

from eth_account import Account
from web3 import Web3

from . import config


def load_abi() -> list:
    with open(config.ABI_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def make_w3() -> Web3:
    if not config.SEPOLIA_RPC_URL:
        raise RuntimeError("SEPOLIA_RPC_URL is not configured")
    return Web3(Web3.HTTPProvider(config.SEPOLIA_RPC_URL, request_kwargs={"timeout": 10}))


def local_verifier_address() -> str:
    if not config.VERIFIER_PRIVATE_KEY:
        raise RuntimeError("verifier key is not configured")
    return Account.from_key(config.VERIFIER_PRIVATE_KEY).address


def health() -> tuple[dict[str, Any], int]:
    """Return (body, status). ok:true only when every check passes."""
    checks: dict[str, Any] = {}
    try:
        w3 = make_w3()
        checks["rpc"] = bool(w3.is_connected())
        if not checks["rpc"]:
            return {"ok": False, "checks": checks}, 503
        chain_id = w3.eth.chain_id
        checks["chainId"] = chain_id
        checks["chainIdOk"] = chain_id == config.EXPECTED_CHAIN_ID
        code = w3.eth.get_code(Web3.to_checksum_address(config.CONTRACT_ADDRESS)) if config.CONTRACT_ADDRESS else b""
        checks["contractDeployed"] = len(code or b"") > 0
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(config.CONTRACT_ADDRESS), abi=load_abi()
        )
        onchain_verifier = contract.functions.verifier().call()
        checks["onchainVerifier"] = onchain_verifier
        derived = local_verifier_address()
        checks["derivedVerifier"] = derived
        matches_expected = True
        if config.EXPECTED_VERIFIER_ADDRESS:
            matches_expected = (
                onchain_verifier.lower() == config.EXPECTED_VERIFIER_ADDRESS.lower()
                and derived.lower() == config.EXPECTED_VERIFIER_ADDRESS.lower()
            )
            checks["expectedVerifier"] = config.EXPECTED_VERIFIER_ADDRESS
        checks["verifierMatch"] = (
            onchain_verifier.lower() == derived.lower() and matches_expected
        )
        ok = bool(
            checks["rpc"]
            and checks["chainIdOk"]
            and checks["contractDeployed"]
            and checks["verifierMatch"]
        )
        return {"ok": ok, "checks": checks}, (200 if ok else 503)
    except Exception as exc:
        checks["error"] = type(exc).__name__
        return {"ok": False, "checks": checks}, 503
