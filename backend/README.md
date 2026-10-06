# TrustKYC backend (Flask + web3.py) - Sepolia demo backend.

> HACKATHON-DEMO QUALITY - OCR/tamper checks are illustrative, not
> production identity verification. Synthetic documents ONLY.

## What it does
- `GET /health` - ok only if RPC connects, chain ID is 11155111,
  contract code exists at `TRUSTKYC_CONTRACT_ADDRESS`, and on-chain
  `verifier()` matches the address derived from `VERIFIER_PRIVATE_KEY`.
- `POST /challenge` - `{applicant}` returns a message for the wallet to
  sign (personal_sign). Binds the later analysis to that wallet.
- `POST /analyze` - multipart `image` + `applicant` + `walletSignature`.
  Runs pixel-only OCR analysis, returns verdict/reasons plus `docHash`.
  On PASS only, returns `attestation` fields for the frontend wallet to
  call `registerPASS(docHash, nonce, expiry, signature)`.
- Backend NEVER sends transactions, NEVER stores PII, deletes temp files.

## Setup (Windows, local run only)
1. Python 3.11+ recommended. Create a venv:
   `py -m venv .venv` then `.venv\Scripts\activate`
2. Install deps: `pip install -r requirements.txt`
3. Install the Tesseract OCR engine (required for real reads):
   - Download the Windows installer (e.g. UB Mannheim builds),
     install, then add its folder to PATH or set
     `TESSDATA_PREFIX` / `pytesseract.pytesseract.tesseract_cmd`.
   - Without Tesseract, every field reports unreadable (no PASS possible).
4. Copy `.env.example` to `.env` and fill `SEPOLIA_RPC_URL` and
   `VERIFIER_PRIVATE_KEY` (fresh values only; never commit `.env`).
5. Run: `python -m backend.app` (from the `trustkyc` folder), then open
   `http://127.0.0.1:5000/health`.

## Notes
- Uses `backend/abi.json` as-is; the ABI is not duplicated in code.
- EIP-712 attestation matches `contracts/TrustKYC.sol` exactly:
  domain `TrustKYC/1/chainId/contract`, type
  `PassAttestation(address applicant,bytes32 docHash,bytes32 nonce,uint256 expiry)`.
- No frontend, deploy, or contract changes in this phase.
